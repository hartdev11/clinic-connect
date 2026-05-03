
from __future__ import annotations
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

@dataclass
class ClinicContext:
    tenant_id: str
    clinic_id: str
    clinic_name: str
    clinic_highlights: List[str]
    branch_id: str
    branch_name: str
    available_services: List[Dict[str, Any]]
    doctors: List[Dict[str, Any]]
    pricing: List[Dict[str, Any]]
    promotions: List[Dict[str, Any]]

class ClinicProfileManager:
    def __init__(self, config_dir: str = "."):
        self.config_dir = Path(config_dir)
        self.clinic_profiles = self._load_json("clinic_profiles.json")
        self.branch_profiles = self._load_json("branch_profiles.json")
        self.doctor_profiles = self._load_json("doctor_profiles.json")
        self.service_catalog = self._load_json("service_catalog.json")
        self.pricing_rules = self._load_json("pricing_rules.json")
        self.promotion_rules = self._load_json("promotion_rules.json")

    def _load_json(self, filename: str) -> List[Dict[str, Any]]:
        file_path = self.config_dir / filename
        if not file_path.exists():
            return []
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _find(self, data, **kwargs):
        for item in data:
            if all(item.get(k) == v for k, v in kwargs.items()):
                return item
        return None

    def _filter(self, data, branch_id, **kwargs):
        result = []
        for item in data:
            if all(item.get(k) == v for k, v in kwargs.items()):
                if item.get("branch_id") in [branch_id, "all"]:
                    result.append(item)
        return result

    def get_clinic_context(self, tenant_id: str, clinic_id: str, branch_id: str) -> ClinicContext:
        clinic = self._find(self.clinic_profiles, tenant_id=tenant_id, clinic_id=clinic_id)
        if not clinic:
            clinic = {"clinic_name": "Default Clinic", "clinic_highlights": []}
        branch = self._find(self.branch_profiles, tenant_id=tenant_id, clinic_id=clinic_id, branch_id=branch_id)
        if not branch:
            branch = {"branch_name": "Default Branch"}
        return ClinicContext(
            tenant_id=tenant_id, clinic_id=clinic_id,
            clinic_name=clinic.get("clinic_name", ""),
            clinic_highlights=clinic.get("clinic_highlights", []),
            branch_id=branch_id,
            branch_name=branch.get("branch_name", ""),
            available_services=self._filter(self.service_catalog, branch_id, tenant_id=tenant_id, clinic_id=clinic_id),
            doctors=self._filter(self.doctor_profiles, branch_id, tenant_id=tenant_id, clinic_id=clinic_id),
            pricing=self._filter(self.pricing_rules, branch_id, tenant_id=tenant_id, clinic_id=clinic_id),
            promotions=self._filter(self.promotion_rules, branch_id, tenant_id=tenant_id, clinic_id=clinic_id),
        )

    def get_price_by_procedure_id(self, tenant_id, clinic_id, branch_id, procedure_id):
        for p in self._filter(self.pricing_rules, branch_id, tenant_id=tenant_id, clinic_id=clinic_id):
            if p.get("procedure_id") == procedure_id:
                return p
        return None
