
import yaml
from typing import Dict, List
import os

class ContextLoader:
    def __init__(self, dataset_path: str = "./dataset"):
        self.dataset_path = dataset_path
        self.data = {
            "procedures": self._load_yaml("procedures.yaml"),
            "comparisons": self._load_yaml("comparisons.yaml"),
            "consultations": self._load_yaml("consultations.yaml"),
            "objections": self._load_yaml("objections.yaml"),
            "concerns": self._load_yaml("concerns.yaml"),
            "packages": self._load_yaml("treatment_packages.yaml")
        }

    def _load_yaml(self, filename: str) -> List[Dict]:
        filepath = os.path.join(self.dataset_path, filename)
        if not os.path.exists(filepath):
            print(f"[WARNING] Missing file: {filename}")
            return []
        with open(filepath, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or []

    def get_procedure_by_id(self, proc_id: str) -> Dict:
        for proc in self.data["procedures"]:
            if proc.get("id") == proc_id:
                return proc
        return {}

    def filter_procedures_by_concern(self, concern: str) -> List[Dict]:
        results = []
        for proc in self.data["procedures"]:
            if concern.lower() in str(proc).lower():
                results.append(proc)
        return results

    def get_comparisons(self, proc_ids: List[str]) -> List[Dict]:
        results = []
        for comp in self.data["comparisons"]:
            items = comp.get("items", [])
            if any(p in items for p in proc_ids):
                results.append(comp)
        return results[:5]

    def get_objections(self, proc_ids: List[str]) -> List[Dict]:
        results = []
        for obj in self.data["objections"]:
            if obj.get("related_procedure") in proc_ids:
                results.append(obj)
        return results[:5]

    def get_packages(self, proc_ids: List[str]) -> List[Dict]:
        results = []
        for pkg in self.data["packages"]:
            if any(p in pkg.get("procedures", []) for p in proc_ids):
                results.append(pkg)
        return results[:3]

    def build_context(self, intent_data: Dict, state: Dict, recommended_proc_ids: List[str]) -> Dict:
        primary_intent = intent_data.get("primary_intent")
        context = {"procedures": [], "comparisons": [], "objections": [], "packages": []}
        context["procedures"] = [self.get_procedure_by_id(pid) for pid in recommended_proc_ids]
        if primary_intent == "comparison":
            context["comparisons"] = self.get_comparisons(recommended_proc_ids)
        if primary_intent == "objection":
            context["objections"] = self.get_objections(recommended_proc_ids)
        context["packages"] = self.get_packages(recommended_proc_ids)
        return context
