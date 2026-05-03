
from __future__ import annotations
import os
from dataclasses import dataclass
from typing import Optional
import firebase_admin
from firebase_admin import credentials, firestore

@dataclass(frozen=True)
class FirebaseConfig:
    project_id: str
    client_email: str
    private_key: str

    @property
    def normalized_private_key(self) -> str:
        key = self.private_key.strip().strip('"').strip("'")
        return key.replace("\\n", "\n")

_FIREBASE_APP: Optional[firebase_admin.App] = None
_FIRESTORE_CLIENT = None

def load_firebase_config() -> FirebaseConfig:
    project_id = os.getenv("FIREBASE_PROJECT_ID", "").strip()
    client_email = os.getenv("FIREBASE_CLIENT_EMAIL", "").strip()
    private_key = os.getenv("FIREBASE_PRIVATE_KEY", "").strip()
    missing = []
    if not project_id: missing.append("FIREBASE_PROJECT_ID")
    if not client_email: missing.append("FIREBASE_CLIENT_EMAIL")
    if not private_key: missing.append("FIREBASE_PRIVATE_KEY")
    if missing:
        raise RuntimeError(f"missing firebase env vars: {', '.join(missing)}")
    return FirebaseConfig(project_id=project_id, client_email=client_email, private_key=private_key)

def get_firebase_app() -> firebase_admin.App:
    global _FIREBASE_APP
    if _FIREBASE_APP is not None:
        return _FIREBASE_APP
    config = load_firebase_config()
    cred_dict = {
        "type": "service_account",
        "project_id": config.project_id,
        "private_key": config.normalized_private_key,
        "client_email": config.client_email,
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    if not firebase_admin._apps:
        _FIREBASE_APP = firebase_admin.initialize_app(
            credentials.Certificate(cred_dict),
            {"projectId": config.project_id},
        )
    else:
        _FIREBASE_APP = firebase_admin.get_app()
    return _FIREBASE_APP

def get_firestore_client():
    global _FIRESTORE_CLIENT
    if _FIRESTORE_CLIENT is None:
        app = get_firebase_app()
        _FIRESTORE_CLIENT = firestore.client(app=app)
    return _FIRESTORE_CLIENT

def check_db_health() -> dict:
    try:
        db = get_firestore_client()
        docs = list(db.collection("organizations").limit(1).stream())
        _ = len(docs)
        return {"status": "ok", "message": "firebase_connected"}
    except Exception as e:
        return {"status": "error", "message": f"firebase_connection_failed:{e}"}

if __name__ == "__main__":
    print("=== FIREBASE CONFIG TEST ===")
    try:
        config = load_firebase_config()
        print({"project_id": config.project_id, "client_email": config.client_email, "private_key_loaded": True})
        print(check_db_health())
    except Exception as e:
        print({"status": "error", "message": str(e)})
