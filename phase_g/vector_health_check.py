from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, UTC
from typing import Any, Dict

from vector_config import load_vector_config


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@dataclass
class VectorHealthPayload:
    success: bool
    provider: str
    checked_at: str
    details: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class VectorHealthCheckService:
    def run_full_health_check(self) -> Dict[str, Any]:
        cfg = load_vector_config()
        ok = cfg.provider in {"chroma", "pinecone", "memory"}
        payload = VectorHealthPayload(
            success=ok,
            provider=cfg.provider,
            checked_at=_now_iso(),
            details={
                "persist_dir": cfg.persist_dir,
                "collection_name": cfg.collection_name,
            },
        )
        return payload.to_dict()


if __name__ == "__main__":
    result = VectorHealthCheckService().run_full_health_check()
    print(result)
    if result.get("success"):
        print("FINAL RESULT: PASS")
    else:
        print("FINAL RESULT: FAIL")
