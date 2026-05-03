from __future__ import annotations
from datetime import datetime, timedelta
from hashlib import sha256
from typing import Any, Dict, List, Optional

RESPONSE_CACHE: Dict[str, Dict[str, Any]] = {}
DEFAULT_TTL_SECONDS = 3600

def _now_iso():
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"

def _now():
    return datetime.utcnow()

def _build_cache_key(user_message, intent, procedure="", feature="", clinic_id="", extra_context=None):
    parts = f"{user_message}|{intent}|{procedure}|{feature}|{clinic_id}|{str(sorted((extra_context or {}).items()))}"
    return "cache_" + sha256(parts.encode()).hexdigest()[:24]

def _is_expired(item):
    expire_at = item.get("expire_at")
    if not expire_at:
        return True
    try:
        exp_dt = datetime.fromisoformat(expire_at.replace("Z", ""))
        return _now() > exp_dt
    except:
        return True

def get_cached_response(user_message, intent, procedure="", feature="", clinic_id="", extra_context=None):
    key = _build_cache_key(user_message, intent, procedure, feature, clinic_id, extra_context)
    item = RESPONSE_CACHE.get(key)
    if not item or _is_expired(item):
        return {"cache_hit": False, "cache_key": key, "cached_item": None}
    item["hit_count"] = item.get("hit_count", 0) + 1
    item["last_hit_at"] = _now_iso()
    return {"cache_hit": True, "cache_key": key, "cached_item": item}

def set_cached_response(user_message, intent, response_text, procedure="", feature="", clinic_id="", model="", extra_context=None, ttl_seconds=DEFAULT_TTL_SECONDS):
    key = _build_cache_key(user_message, intent, procedure, feature, clinic_id, extra_context)
    now = _now()
    expire_at = (now + timedelta(seconds=ttl_seconds)).replace(microsecond=0).isoformat() + "Z"
    item = {
        "cache_key": key,
        "user_message": user_message,
        "intent": intent,
        "procedure": procedure,
        "feature": feature,
        "clinic_id": clinic_id,
        "model": model,
        "response_text": response_text,
        "ttl_seconds": ttl_seconds,
        "extra_context": extra_context or {},
        "metadata": {},
        "hit_count": 0,
        "created_at": _now_iso(),
        "expire_at": expire_at,
        "last_hit_at": None,
    }
    RESPONSE_CACHE[key] = item
    return {"cache_hit": False, "cache_key": key, "cached_item": item}

def get_or_set_cached_response(user_message, intent, response_text=None, procedure="", feature="", clinic_id="", model="", extra_context=None, ttl_seconds=DEFAULT_TTL_SECONDS):
    result = get_cached_response(user_message=user_message, intent=intent, procedure=procedure, feature=feature, clinic_id=clinic_id, extra_context=extra_context)
    if result["cache_hit"]:
        return result
    if response_text:
        return set_cached_response(user_message=user_message, intent=intent, response_text=response_text, procedure=procedure, feature=feature, clinic_id=clinic_id, model=model, extra_context=extra_context, ttl_seconds=ttl_seconds)
    return {"cache_hit": False, "cache_key": result["cache_key"], "cached_item": None}

def invalidate_cache(cache_key):
    if cache_key in RESPONSE_CACHE:
        del RESPONSE_CACHE[cache_key]
        return {"invalidated": True, "cache_key": cache_key}
    return {"invalidated": False, "cache_key": cache_key}

def get_cache_stats():
    total = len(RESPONSE_CACHE)
    expired = sum(1 for item in RESPONSE_CACHE.values() if _is_expired(item))
    total_hits = sum(item.get("hit_count", 0) for item in RESPONSE_CACHE.values())
    return {"total_items": total, "expired_items": expired, "active_items": total - expired, "total_hits": total_hits}

def list_cache_items(clinic_id=None, feature=None):
    results = list(RESPONSE_CACHE.values())
    if clinic_id:
        results = [x for x in results if x.get("clinic_id") == clinic_id]
    if feature:
        results = [x for x in results if x.get("feature") == feature]
    return results

def validate_cache_item(item):
    errors = []
    required = ["cache_key","user_message","intent","response_text","ttl_seconds","created_at","expire_at","hit_count"]
    for field in required:
        if field not in item:
            errors.append(f"missing {field}")
    if not item.get("cache_key"):
        errors.append("cache_key is empty")
    if int(item.get("ttl_seconds", 0)) <= 0:
        errors.append("ttl_seconds must > 0")
    if not isinstance(item.get("metadata", {}), dict):
        errors.append("metadata must be a dict")
    if not isinstance(item.get("extra_context", {}), dict):
        errors.append("extra_context must be a dict")
    return {"valid": len(errors) == 0, "errors": errors}

if __name__ == "__main__":
    print("=== RESPONSE CACHE TEST ===")
    r1 = get_or_set_cached_response(
        user_message="Botox ช่วยอะไร", intent="faq",
        response_text="Botox ช่วยลดริ้วรอยค่ะ",
        procedure="botox", feature="faq_assist", clinic_id="clinic_1",
        model="gpt-4o-mini", extra_context={"language": "th"},
    )
    print("WRITE:", r1["cache_hit"], r1["cache_key"])
    print(validate_cache_item(r1["cached_item"]))
    r2 = get_or_set_cached_response(
        user_message="Botox ช่วยอะไร", intent="faq",
        procedure="botox", feature="faq_assist", clinic_id="clinic_1",
        extra_context={"language": "th"},
    )
    print("READ hit:", r2["cache_hit"])
    print("STATS:", get_cache_stats())
