from __future__ import annotations
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

USERS: Dict[str, Dict[str, Any]] = {}
SESSIONS: Dict[str, Dict[str, Any]] = {}
SESSION_REVOCATIONS: List[Dict[str, Any]] = []

DEFAULT_AUTH_CONFIG = {
    "default_session_ttl_minutes": 720,
    "refresh_supported": True,
    "reject_inactive_user": True,
    "reject_suspended_user": True,
    "single_active_session_per_user": False,
}

def _now(): return datetime.utcnow()
def _now_iso(): return _now().replace(microsecond=0).isoformat() + "Z"
def _parse_iso(value):
    if not value: return None
    try: return datetime.fromisoformat(str(value).replace("Z",""))
    except: return None
def _normalize_text(value):
    if value is None: return ""
    return str(value).strip().lower()
def _generate_session_id(): return f"sess_{uuid4().hex[:16]}"
def _generate_internal_token(): return f"tok_{uuid4().hex}"
def _compute_expire_at(ttl_minutes):
    return (_now() + timedelta(minutes=max(1, int(ttl_minutes)))).replace(microsecond=0).isoformat() + "Z"
def _is_expired(expires_at):
    dt = _parse_iso(expires_at)
    if not dt: return False
    return _now() > dt

def get_user_by_user_id(user_id): return USERS.get(user_id)

def get_user_by_email(email):
    target = _normalize_text(email)
    for user in USERS.values():
        if _normalize_text(user.get("email")) == target: return user
    return None

def is_user_login_allowed(user, auth_config=None):
    config = auth_config or DEFAULT_AUTH_CONFIG
    status = _normalize_text(user.get("status","active"))
    if config.get("reject_inactive_user",True) and status == "inactive": return {"allowed":False,"reason":"inactive_user"}
    if config.get("reject_suspended_user",True) and status == "suspended": return {"allowed":False,"reason":"suspended_user"}
    return {"allowed":True,"reason":"ok"}

def create_session(user, firebase_token=None, ip_address=None, user_agent=None, auth_config=None):
    config = auth_config or DEFAULT_AUTH_CONFIG
    allow = is_user_login_allowed(user, auth_config=config)
    if not allow["allowed"]: raise ValueError(allow["reason"])
    user_id = user["user_id"]
    if config.get("single_active_session_per_user",False): revoke_user_sessions(user_id=user_id, reason="single_session_policy")
    session_id = _generate_session_id()
    token = _generate_internal_token()
    ttl_minutes = int(config.get("default_session_ttl_minutes",720))
    session = {"session_id":session_id,"user_id":user_id,"token":token,"firebase_token":firebase_token,"email":user.get("email"),"primary_role":user.get("primary_role"),"assigned_roles":user.get("assigned_roles",[user.get("primary_role")] if user.get("primary_role") else []),"partner_id":user.get("partner_id"),"tenant_id":user.get("tenant_id"),"clinic_id":user.get("clinic_id"),"branch_id":user.get("branch_id"),"ip_address":ip_address,"user_agent":user_agent,"status":"active","issued_at":_now_iso(),"expires_at":_compute_expire_at(ttl_minutes),"last_validated_at":None,"revoked_at":None,"revoked_reason":None}
    SESSIONS[session_id] = session
    return session

def login_with_email(email, firebase_token=None, ip_address=None, user_agent=None, auth_config=None):
    user = get_user_by_email(email)
    if not user: return {"success":False,"reason":"user_not_found","session":None}
    try:
        session = create_session(user=user, firebase_token=firebase_token, ip_address=ip_address, user_agent=user_agent, auth_config=auth_config)
        return {"success":True,"reason":"ok","session":session}
    except Exception as e:
        return {"success":False,"reason":str(e),"session":None}

def get_session(session_id): return SESSIONS.get(session_id)

def get_session_by_token(token):
    target = _normalize_text(token)
    for session in SESSIONS.values():
        if _normalize_text(session.get("token")) == target: return session
    return None

def validate_session(token, auth_config=None):
    config = auth_config or DEFAULT_AUTH_CONFIG
    session = get_session_by_token(token)
    if not session: return {"valid":False,"reason":"session_not_found","session":None,"user":None}
    if session.get("status") != "active": return {"valid":False,"reason":"session_inactive","session":session,"user":None}
    if _is_expired(session.get("expires_at")):
        session["status"] = "expired"
        return {"valid":False,"reason":"session_expired","session":session,"user":None}
    user = get_user_by_user_id(session["user_id"])
    if not user: return {"valid":False,"reason":"user_not_found","session":session,"user":None}
    allow = is_user_login_allowed(user, auth_config=config)
    if not allow["allowed"]: return {"valid":False,"reason":allow["reason"],"session":session,"user":user}
    session["last_validated_at"] = _now_iso()
    return {"valid":True,"reason":"ok","session":session,"user":user}

def refresh_session(token, auth_config=None):
    config = auth_config or DEFAULT_AUTH_CONFIG
    if not config.get("refresh_supported",True): return {"success":False,"reason":"refresh_not_supported","session":None}
    validation = validate_session(token, auth_config=config)
    if not validation["valid"]: return {"success":False,"reason":validation["reason"],"session":validation.get("session")}
    session = validation["session"]
    ttl_minutes = int(config.get("default_session_ttl_minutes",720))
    session["expires_at"] = _compute_expire_at(ttl_minutes)
    session["last_validated_at"] = _now_iso()
    return {"success":True,"reason":"ok","session":session}

def revoke_session(session_id, reason="manual_logout"):
    session = get_session(session_id)
    if not session: return {"success":False,"reason":"session_not_found","session":None}
    session["status"] = "revoked"
    session["revoked_at"] = _now_iso()
    session["revoked_reason"] = reason
    SESSION_REVOCATIONS.append({"session_id":session_id,"user_id":session.get("user_id"),"reason":reason,"revoked_at":session["revoked_at"]})
    return {"success":True,"reason":"ok","session":session}

def revoke_user_sessions(user_id, reason="user_logout_all"):
    count = 0
    for session in SESSIONS.values():
        if session.get("user_id") == user_id and session.get("status") == "active":
            session["status"] = "revoked"
            session["revoked_at"] = _now_iso()
            session["revoked_reason"] = reason
            SESSION_REVOCATIONS.append({"session_id":session["session_id"],"user_id":user_id,"reason":reason,"revoked_at":session["revoked_at"]})
            count += 1
    return {"success":True,"reason":"ok","revoked_count":count}

def logout_by_token(token, reason="logout"):
    session = get_session_by_token(token)
    if not session: return {"success":False,"reason":"session_not_found"}
    return revoke_session(session["session_id"], reason=reason)

def build_auth_context(token, auth_config=None):
    validation = validate_session(token, auth_config=auth_config)
    if not validation["valid"]: return {"authenticated":False,"reason":validation["reason"],"auth_context":None}
    session = validation["session"]
    user = validation["user"]
    auth_context = {"user_id":user["user_id"],"email":user.get("email"),"full_name":user.get("full_name"),"status":user.get("status"),"primary_role":user.get("primary_role"),"assigned_roles":user.get("assigned_roles",[user.get("primary_role")] if user.get("primary_role") else []),"partner_id":user.get("partner_id"),"tenant_id":user.get("tenant_id"),"clinic_id":user.get("clinic_id"),"branch_id":user.get("branch_id"),"session_id":session.get("session_id"),"session_status":session.get("status"),"token":session.get("token")}
    return {"authenticated":True,"reason":"ok","auth_context":auth_context}

def validate_session_object(session):
    errors = []
    for field in ["session_id","user_id","token","status","issued_at","expires_at"]:
        if field not in session: errors.append(f"missing {field}")
    if session.get("status") not in {"active","revoked","expired"}: errors.append("invalid status")
    return {"valid": len(errors)==0, "errors": errors}

def validate_auth_context_object(obj):
    errors = []
    if "authenticated" not in obj: errors.append("missing authenticated")
    if "reason" not in obj: errors.append("missing reason")
    if obj.get("authenticated") is True and not isinstance(obj.get("auth_context"), dict): errors.append("auth_context must be dict when authenticated=true")
    return {"valid": len(errors)==0, "errors": errors}

def seed_demo_users():
    USERS["u_001"] = {"user_id":"u_001","email":"owner@clinic.com","full_name":"Clinic Owner","partner_id":None,"tenant_id":"t_001","clinic_id":"c_001","branch_id":None,"status":"active","primary_role":"clinic_owner","assigned_roles":["clinic_owner"]}
    USERS["u_002"] = {"user_id":"u_002","email":"staff@clinic.com","full_name":"Clinic Staff","partner_id":None,"tenant_id":"t_001","clinic_id":"c_001","branch_id":"b_001","status":"active","primary_role":"staff","assigned_roles":["staff"]}
    USERS["u_003"] = {"user_id":"u_003","email":"suspended@clinic.com","full_name":"Suspended User","partner_id":None,"tenant_id":"t_001","clinic_id":"c_001","branch_id":None,"status":"suspended","primary_role":"clinic_admin","assigned_roles":["clinic_admin"]}

if __name__ == "__main__":
    print("=== AUTH SESSION MANAGER TEST ===")
    seed_demo_users()
    login = login_with_email(email="owner@clinic.com", firebase_token="firebase_demo_token", ip_address="127.0.0.1", user_agent="test-agent")
    print("LOGIN:", login)
    if login["success"]:
        session = login["session"]
        print("SESSION VALID:", validate_session_object(session))
        validate = validate_session(session["token"])
        print("VALIDATE:", validate)
        auth_ctx = build_auth_context(session["token"])
        print("AUTH CONTEXT:", auth_ctx)
        print("AUTH CONTEXT VALID:", validate_auth_context_object(auth_ctx))
        refreshed = refresh_session(session["token"])
        print("REFRESH:", refreshed)
        logout = logout_by_token(session["token"])
        print("LOGOUT:", logout)
    suspended = login_with_email(email="suspended@clinic.com")
    print("SUSPENDED LOGIN:", suspended)
