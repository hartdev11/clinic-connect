from __future__ import annotations
import os
from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from db_config import check_db_health
from dashboard_repository import DashboardFilters
from dashboard_query_service import (
    build_agent_dashboard_data,
    build_affiliate_dashboard_data,
    build_branch_dashboard_data,
    build_clinic_dashboard_data,
    build_owner_dashboard_data,
)

APP_NAME = "Phase K Dashboard API"
APP_VERSION = "k-firebase-prod"
DASHBOARD_MODE = os.getenv("DASHBOARD_MODE", "prod").strip().lower()

app = FastAPI(title=APP_NAME, version=APP_VERSION)

def _ensure_prod_mode():
    if DASHBOARD_MODE != "prod":
        raise HTTPException(status_code=503, detail="dashboard_api requires DASHBOARD_MODE=prod")

def _build_filters(tenant_id=None, clinic_id=None, branch_id=None, affiliate_id=None, agent_id=None, date_from=None, date_to=None):
    return DashboardFilters(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, affiliate_id=affiliate_id, agent_id=agent_id, date_from=date_from, date_to=date_to)

def _validate_required_param(value, name):
    if not value:
        raise HTTPException(status_code=400, detail=f"missing required query param: {name}")

def _handle_error(exc):
    message = str(exc).lower()
    if "permission" in message: raise HTTPException(status_code=500, detail="firebase_permission_denied")
    if "credential" in message or "certificate" in message: raise HTTPException(status_code=500, detail="firebase_credentials_error")
    if "deadline" in message or "timeout" in message: raise HTTPException(status_code=504, detail="firebase_query_timeout")
    raise HTTPException(status_code=500, detail=f"dashboard_runtime_error: {exc}")

@app.get("/health")
def health():
    db_health = check_db_health()
    return {"status":"ok" if db_health.get("status")=="ok" else "error","app":APP_NAME,"version":APP_VERSION,"mode":DASHBOARD_MODE,"data_source":"firebase" if DASHBOARD_MODE=="prod" else "non_prod","database":db_health}

@app.get("/dashboard/owner")
def get_owner_dashboard(tenant_id: Optional[str]=Query(default=None), clinic_id: Optional[str]=Query(default=None), branch_id: Optional[str]=Query(default=None), affiliate_id: Optional[str]=Query(default=None), agent_id: Optional[str]=Query(default=None), date_from: Optional[str]=Query(default=None), date_to: Optional[str]=Query(default=None)):
    _ensure_prod_mode()
    try: return build_owner_dashboard_data(_build_filters(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, affiliate_id=affiliate_id, agent_id=agent_id, date_from=date_from, date_to=date_to))
    except Exception as exc: _handle_error(exc)

@app.get("/dashboard/clinic")
def get_clinic_dashboard(tenant_id: Optional[str]=Query(default=None), clinic_id: Optional[str]=Query(default=None), branch_id: Optional[str]=Query(default=None), date_from: Optional[str]=Query(default=None), date_to: Optional[str]=Query(default=None)):
    _ensure_prod_mode()
    try: return build_clinic_dashboard_data(_build_filters(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, date_from=date_from, date_to=date_to))
    except Exception as exc: _handle_error(exc)

@app.get("/dashboard/branch")
def get_branch_dashboard(tenant_id: Optional[str]=Query(default=None), clinic_id: Optional[str]=Query(default=None), branch_id: Optional[str]=Query(default=None), date_from: Optional[str]=Query(default=None), date_to: Optional[str]=Query(default=None)):
    _ensure_prod_mode()
    _validate_required_param(branch_id, "branch_id")
    try: return build_branch_dashboard_data(_build_filters(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, date_from=date_from, date_to=date_to))
    except Exception as exc: _handle_error(exc)

@app.get("/dashboard/affiliate")
def get_affiliate_dashboard(tenant_id: Optional[str]=Query(default=None), clinic_id: Optional[str]=Query(default=None), branch_id: Optional[str]=Query(default=None), affiliate_id: Optional[str]=Query(default=None), date_from: Optional[str]=Query(default=None), date_to: Optional[str]=Query(default=None)):
    _ensure_prod_mode()
    try: return build_affiliate_dashboard_data(_build_filters(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, affiliate_id=affiliate_id, date_from=date_from, date_to=date_to))
    except Exception as exc: _handle_error(exc)

@app.get("/dashboard/agent")
def get_agent_dashboard(tenant_id: Optional[str]=Query(default=None), clinic_id: Optional[str]=Query(default=None), branch_id: Optional[str]=Query(default=None), agent_id: Optional[str]=Query(default=None), date_from: Optional[str]=Query(default=None), date_to: Optional[str]=Query(default=None)):
    _ensure_prod_mode()
    try: return build_agent_dashboard_data(_build_filters(tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id, agent_id=agent_id, date_from=date_from, date_to=date_to))
    except Exception as exc: _handle_error(exc)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("dashboard_api:app", host="0.0.0.0", port=8000, reload=False)
