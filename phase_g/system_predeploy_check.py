from __future__ import annotations

import importlib
import os
import subprocess
import sys
import traceback
from dataclasses import dataclass, asdict
from datetime import datetime, UTC
from typing import Any, Dict, List


REQUIRED_ENV_VARS = [
    "APP_ENV",
    "FIREBASE_PROJECT_ID",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_PRIVATE_KEY",
    "VECTOR_DB_PROVIDER",
]

OPTIONAL_ENV_VARS = [
    "OPENAI_API_KEY",
    "OPENROUTER_API_KEY",
    "CHROMA_PERSIST_DIR",
    "CHROMA_COLLECTION_NAME",
    "LINE_CHANNEL_SECRET",
    "LINE_CHANNEL_ACCESS_TOKEN",
]

VALIDATOR_SCRIPTS = [
    "phase_h_validator.py",
    "phase_i_validator.py",
    "phase_j_validator.py",
    "phase_j_final_check.py",
    "phase_m_validator.py",
    "phase_n_validator.py",
    "phase_n_final_check.py",
    "vector_health_check.py",
    "vector_layer_validator.py",
    "hybrid_retrieval_validator.py",
]

REQUIRED_IMPORT_MODULES = [
    "vector_config",
    "vector_models",
    "vector_store_interface",
    "vector_store_factory",
    "chunking_service",
    "embedding_service",
    "indexing_service",
    "retrieval_service",
    "intent_classifier",
    "brain_router",
    "context_builder",
    "response_policy",
    "prompt_v4",
    "decision_engine",
    "hard_context_builder",
    "anti_generic_guard",
    "retrieval_router",
    "retrieval_telemetry_logger",
    "runtime_response_engine",
]

SCRIPT_TIMEOUT_SECONDS = 180


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _load_env_file_if_exists() -> None:
    """
    Load ../.env.local into process env for predeploy checks.
    Existing process env values keep priority.
    """
    root_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
    if not os.path.exists(root_env):
        return
    try:
        with open(root_env, "r", encoding="utf-8") as f:
            for raw in f:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                key = k.strip()
                value = v.strip().strip("\"'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except Exception:
        # Env loader failure should not crash predeploy checks.
        pass


def _contains_pass_signal(text: str) -> bool:
    upper = text.upper()
    signals = ["FINAL RESULT: PASS", "FINAL: PASS", "PASS —", "PASS -"]
    return any(s in upper for s in signals)


def _contains_fail_signal(text: str) -> bool:
    upper = text.upper()
    signals = ["FINAL RESULT: FAIL", "FINAL: FAIL", "[FAIL]", "TRACEBACK"]
    return any(s in upper for s in signals)


def _run_python_script(script_path: str, timeout: int = SCRIPT_TIMEOUT_SECONDS) -> Dict[str, Any]:
    try:
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = (result.stdout or "") + "\n" + (result.stderr or "")
        success = result.returncode == 0 and _contains_pass_signal(output) and not _contains_fail_signal(output)
        return {
            "script": script_path,
            "success": success,
            "returncode": result.returncode,
            "output": output.strip(),
        }
    except subprocess.TimeoutExpired:
        return {
            "script": script_path,
            "success": False,
            "returncode": None,
            "output": f"Timeout after {timeout} seconds",
        }
    except Exception as e:
        return {
            "script": script_path,
            "success": False,
            "returncode": None,
            "output": f"{type(e).__name__}: {e}",
        }


def _import_module_check(module_name: str) -> Dict[str, Any]:
    try:
        importlib.import_module(module_name)
        return {"module": module_name, "success": True, "error": None}
    except Exception as e:
        return {"module": module_name, "success": False, "error": f"{type(e).__name__}: {e}"}


@dataclass
class CheckResult:
    name: str
    success: bool
    details: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def check_environment() -> CheckResult:
    missing_required = [x for x in REQUIRED_ENV_VARS if not os.getenv(x)]
    present_optional = [x for x in OPTIONAL_ENV_VARS if os.getenv(x)]
    app_env = os.getenv("APP_ENV", "").strip().lower()

    errors: List[str] = []
    if missing_required:
        errors.append(f"missing required env vars: {missing_required}")
    if app_env and app_env not in {"staging", "production", "development", "dev", "test"}:
        errors.append(f"unexpected APP_ENV value: {app_env}")
    if app_env == "production":
        errors.append("APP_ENV is production. This script is intended before staging deploy.")

    return CheckResult(
        name="environment",
        success=len(errors) == 0,
        details={
            "app_env": app_env or None,
            "missing_required": missing_required,
            "present_optional": present_optional,
            "errors": errors,
        },
    )


def check_required_modules() -> CheckResult:
    results = [_import_module_check(m) for m in REQUIRED_IMPORT_MODULES]
    failures = [x for x in results if not x["success"]]
    return CheckResult(
        name="required_modules",
        success=len(failures) == 0,
        details={"results": results, "failures": failures},
    )


def check_validator_scripts_exist() -> CheckResult:
    missing = [x for x in VALIDATOR_SCRIPTS if not os.path.exists(x)]
    existing = [x for x in VALIDATOR_SCRIPTS if os.path.exists(x)]
    return CheckResult(
        name="validator_scripts_exist",
        success=len(missing) == 0,
        details={"existing": existing, "missing": missing},
    )


def run_validator_scripts() -> CheckResult:
    results = []
    for script in VALIDATOR_SCRIPTS:
        if not os.path.exists(script):
            results.append({"script": script, "success": False, "returncode": None, "output": "file not found"})
            continue
        results.append(_run_python_script(script))
    failures = [x for x in results if not x["success"]]
    return CheckResult(
        name="validator_scripts",
        success=len(failures) == 0,
        details={"results": results, "failures": failures},
    )


def check_vector_stack_runtime() -> CheckResult:
    try:
        mod = importlib.import_module("vector_health_check")
        if not hasattr(mod, "VectorHealthCheckService"):
            return CheckResult(
                name="vector_stack_runtime",
                success=False,
                details={"error": "VectorHealthCheckService not found"},
            )
        service = mod.VectorHealthCheckService()
        payload = service.run_full_health_check()
        success = bool(payload.get("success"))
        return CheckResult(name="vector_stack_runtime", success=success, details=payload)
    except Exception as e:
        return CheckResult(
            name="vector_stack_runtime",
            success=False,
            details={"error": f"{type(e).__name__}: {e}", "traceback": traceback.format_exc()},
        )


def check_hybrid_stack_runtime() -> CheckResult:
    try:
        importlib.import_module("retrieval_service")
        hybrid_module = importlib.import_module("hybrid_retrieval_validator")
        if not hasattr(hybrid_module, "HybridRetrievalValidator"):
            return CheckResult(
                name="hybrid_stack_runtime",
                success=False,
                details={"error": "HybridRetrievalValidator not found"},
            )
        return CheckResult(
            name="hybrid_stack_runtime",
            success=True,
            details={"note": "Hybrid validator import OK. Run script hybrid_retrieval_validator.py for full live validation."},
        )
    except Exception as e:
        return CheckResult(
            name="hybrid_stack_runtime",
            success=False,
            details={"error": f"{type(e).__name__}: {e}", "traceback": traceback.format_exc()},
        )


def check_response_stack_structure() -> CheckResult:
    try:
        intent_mod = importlib.import_module("intent_classifier")
        brain_mod = importlib.import_module("brain_router")
        context_mod = importlib.import_module("context_builder")
        policy_mod = importlib.import_module("response_policy")
        prompt_mod = importlib.import_module("prompt_v4")
        decision_mod = importlib.import_module("decision_engine")
        hard_context_mod = importlib.import_module("hard_context_builder")
        anti_generic_mod = importlib.import_module("anti_generic_guard")
        router_mod = importlib.import_module("retrieval_router")
        telemetry_mod = importlib.import_module("retrieval_telemetry_logger")
        runtime_mod = importlib.import_module("runtime_response_engine")

        errors: List[str] = []
        if not hasattr(intent_mod, "classify_intent"):
            errors.append("intent_classifier.classify_intent missing")
        if not hasattr(brain_mod, "route_intent"):
            errors.append("brain_router.route_intent missing")
        if not hasattr(context_mod, "build_context"):
            errors.append("context_builder.build_context missing")
        if not hasattr(context_mod, "render_prompt_context"):
            errors.append("context_builder.render_prompt_context missing")
        if not hasattr(policy_mod, "evaluate_response_policy"):
            errors.append("response_policy.evaluate_response_policy missing")
        if not hasattr(prompt_mod, "build_prompt_package"):
            errors.append("prompt_v4.build_prompt_package missing")
        if not hasattr(decision_mod, "decide_response_plan"):
            errors.append("decision_engine.decide_response_plan missing")
        if not hasattr(hard_context_mod, "build_hard_context"):
            errors.append("hard_context_builder.build_hard_context missing")
        if not hasattr(anti_generic_mod, "evaluate_anti_generic_guard"):
            errors.append("anti_generic_guard.evaluate_anti_generic_guard missing")
        if not hasattr(anti_generic_mod, "build_anti_generic_regeneration_instruction"):
            errors.append("anti_generic_guard.build_anti_generic_regeneration_instruction missing")
        if not hasattr(router_mod, "create_retrieval_router"):
            errors.append("retrieval_router.create_retrieval_router missing")
        if not hasattr(telemetry_mod, "log_retrieval_telemetry"):
            errors.append("retrieval_telemetry_logger.log_retrieval_telemetry missing")
        if not hasattr(runtime_mod, "RuntimeResponseEngine"):
            errors.append("runtime_response_engine.RuntimeResponseEngine missing")

        return CheckResult(name="response_stack_structure", success=len(errors) == 0, details={"errors": errors})
    except Exception as e:
        return CheckResult(
            name="response_stack_structure",
            success=False,
            details={"error": f"{type(e).__name__}: {e}", "traceback": traceback.format_exc()},
        )


def check_cross_phase_expectations() -> CheckResult:
    expected_modules = [
        "retrieval_service",
        "indexing_service",
        "vector_health_check",
        "hybrid_retrieval_validator",
        "intent_classifier",
        "brain_router",
        "context_builder",
        "response_policy",
        "prompt_v4",
        "decision_engine",
        "hard_context_builder",
        "anti_generic_guard",
        "retrieval_router",
        "retrieval_telemetry_logger",
        "runtime_response_engine",
    ]
    found = []
    missing = []
    for module in expected_modules:
        try:
            importlib.import_module(module)
            found.append(module)
        except Exception:
            missing.append(module)
    return CheckResult(
        name="cross_phase_expectations",
        success=len(missing) == 0,
        details={"found": found, "missing": missing, "note": "structural integration check only; business UAT still required"},
    )


def check_staging_readiness_flags() -> CheckResult:
    vector_provider = os.getenv("VECTOR_DB_PROVIDER", "").strip().lower()
    app_env = os.getenv("APP_ENV", "").strip().lower()

    errors: List[str] = []
    if not vector_provider:
        errors.append("VECTOR_DB_PROVIDER missing")
    if vector_provider not in {"chroma", "pinecone"}:
        errors.append(f"unsupported VECTOR_DB_PROVIDER={vector_provider}")
    if app_env != "staging":
        errors.append("APP_ENV should be 'staging' before staging deploy")
    if vector_provider != "chroma":
        errors.append("current expected staging provider is chroma")

    return CheckResult(
        name="staging_readiness_flags",
        success=len(errors) == 0,
        details={"app_env": app_env or None, "vector_provider": vector_provider or None, "errors": errors},
    )


def run_system_predeploy_check() -> Dict[str, Any]:
    _load_env_file_if_exists()
    checks: List[CheckResult] = [
        check_environment(),
        check_required_modules(),
        check_validator_scripts_exist(),
        run_validator_scripts(),
        check_vector_stack_runtime(),
        check_hybrid_stack_runtime(),
        check_response_stack_structure(),
        check_cross_phase_expectations(),
        check_staging_readiness_flags(),
    ]
    success = all(x.success for x in checks)
    summary = {
        "total_checks": len(checks),
        "passed": sum(1 for x in checks if x.success),
        "failed": sum(1 for x in checks if not x.success),
    }
    report = {
        "success": success,
        "checked_at": _now_iso(),
        "summary": summary,
        "checks": [x.to_dict() for x in checks],
    }

    print("\n=== SYSTEM PREDEPLOY CHECK ===\n")
    for item in checks:
        status = "PASS" if item.success else "FAIL"
        print(f"[{status}] {item.name}")
    print("\n========================")
    if success:
        print("FINAL RESULT: PASS — READY FOR STAGING DEPLOY")
    else:
        print("FINAL RESULT: FAIL — FIX REQUIRED BEFORE DEPLOY")
    return report


if __name__ == "__main__":
    run_system_predeploy_check()
