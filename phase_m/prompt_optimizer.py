from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Optional

INTENT_CONTEXT_MAP = {
    "faq":          ["procedure_info", "clinic_info"],
    "comparison":   ["procedure_info", "comparison_info", "clinic_info"],
    "pricing":      ["procedure_info", "promotion_info", "clinic_info"],
    "booking":      ["procedure_info", "promotion_info", "schedule_info", "branch_info"],
    "objection":    ["procedure_info", "safety_info", "social_proof"],
    "recommendation": ["customer_profile", "procedure_info", "promotion_info"],
    "default":      ["procedure_info", "clinic_info"],
}

MAX_SYSTEM_PROMPT_CHARS = 600
MAX_HISTORY_MESSAGES = 6

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _safe_str(v):
    if not v: return ""
    return " ".join(str(v).split())

def truncate_system_prompt(system_prompt: str, max_chars: int = MAX_SYSTEM_PROMPT_CHARS) -> str:
    cleaned = _safe_str(system_prompt)
    if len(cleaned) <= max_chars:
        return cleaned
    return cleaned[:max_chars].rsplit(" ", 1)[0] + "..."

def trim_history(history: List[Dict], max_messages: int = MAX_HISTORY_MESSAGES) -> List[Dict]:
    if not history:
        return []
    if len(history) <= max_messages:
        return history
    return history[-max_messages:]

def select_context(context_payload: Dict[str, Any], intent: str) -> Dict[str, Any]:
    allowed_keys = INTENT_CONTEXT_MAP.get(intent, INTENT_CONTEXT_MAP["default"])
    return {k: v for k, v in context_payload.items() if k in allowed_keys and v}

def build_optimized_prompt_package(
    intent: str,
    system_prompt: str,
    history_messages: List[Dict],
    context_payload: Dict[str, Any],
    max_system_chars: int = MAX_SYSTEM_PROMPT_CHARS,
    max_history: int = MAX_HISTORY_MESSAGES,
) -> Dict[str, Any]:
    optimized_system = truncate_system_prompt(system_prompt, max_system_chars)
    trimmed_history = trim_history(history_messages, max_history)
    selected_context = select_context(context_payload, intent)
    return {
        "intent": intent,
        "system_prompt": optimized_system,
        "history_messages": trimmed_history,
        "context": selected_context,
        "system_prompt_chars": len(optimized_system),
        "history_count": len(trimmed_history),
        "context_keys": list(selected_context.keys()),
        "generated_at": _now_iso(),
    }

def estimate_prompt_saving(
    original_system_prompt: str,
    optimized_system_prompt: str,
    original_history_count: int,
    optimized_history_count: int,
) -> Dict[str, Any]:
    orig_chars = len(_safe_str(original_system_prompt))
    opt_chars = len(optimized_system_prompt)
    saved_chars = max(orig_chars - opt_chars, 0)
    saved_history = max(original_history_count - optimized_history_count, 0)
    return {
        "original_system_chars": orig_chars,
        "optimized_system_chars": opt_chars,
        "saved_system_chars": saved_chars,
        "original_history_count": original_history_count,
        "optimized_history_count": optimized_history_count,
        "saved_history_messages": saved_history,
    }

def validate_prompt_package(package: Dict[str, Any]) -> Dict[str, Any]:
    errors = []
    for field in ["intent", "system_prompt", "history_messages", "context", "generated_at"]:
        if field not in package:
            errors.append(f"missing field: {field}")
    if not isinstance(package.get("history_messages", []), list):
        errors.append("history_messages must be a list")
    if not isinstance(package.get("context", {}), dict):
        errors.append("context must be a dict")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    print("=== PROMPT OPTIMIZER TEST ===")
    system_prompt = "You are an AI sales assistant for a beauty clinic. Help answer questions, recommend procedures, and guide toward booking."
    history = [
        {"role": "user", "content": "สวัสดีค่ะ"},
        {"role": "assistant", "content": "สวัสดีค่ะ"},
        {"role": "user", "content": "อยากลดริ้วรอย"},
        {"role": "assistant", "content": "มีหลายตัวเลือกค่ะ"},
        {"role": "user", "content": "Botox กับ Filler ต่างกันยังไง"},
    ]
    context_payload = {
        "customer_profile": {"concern": "wrinkle"},
        "procedure_info": {"botox": "reduces wrinkles"},
        "comparison_info": {"botox_vs_filler": "different use cases"},
        "promotion_info": {"botox_promo": "10% off"},
        "clinic_info": {"name": "Demo Clinic"},
        "schedule_info": {"next": "tomorrow"},
    }
    pkg = build_optimized_prompt_package(
        intent="comparison",
        system_prompt=system_prompt,
        history_messages=history,
        context_payload=context_payload,
    )
    print(pkg)
    print(validate_prompt_package(pkg))
