import yaml
import os
from collections import defaultdict

DATASET_PATH = "dataset"

REQUIRED_FIELDS = {
    "procedures.yaml": ["id", "name", "description"],
    "comparisons.yaml": ["id", "items", "comparison_points"],
    "consultations.yaml": ["id", "question", "answer"],
    "objections.yaml": ["id", "objection", "response"],
    "concerns.yaml": ["id", "concern", "description"],
    "treatment_packages.yaml": ["id", "name", "procedures"]
}

def load_yaml(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def validate_file(file_name):
    file_path = os.path.join(DATASET_PATH, file_name)
    print(f"\nChecking {file_name}...")
    try:
        data = load_yaml(file_path)
    except Exception as e:
        print(f"❌ YAML ERROR: {e}")
        return
    items = data if isinstance(data, list) else data.get("packages", [])
    seen_ids = set()
    errors = 0
    for i, item in enumerate(items):
        if "id" not in item:
            print(f"❌ Missing id at index {i}")
            errors += 1
            continue
        if item["id"] in seen_ids:
            print(f"❌ Duplicate id: {item['id']}")
            errors += 1
        seen_ids.add(item["id"])
        for field in REQUIRED_FIELDS[file_name]:
            if field not in item:
                print(f"❌ Missing field '{field}' in {item['id']}")
                errors += 1
    if errors == 0:
        print(f"✅ {file_name} checked ({len(items)} items) — no errors")
    else:
        print(f"⚠️ {file_name} checked ({len(items)} items) — {errors} errors")

def main():
    for file in REQUIRED_FIELDS.keys():
        validate_file(file)

if __name__ == "__main__":
    main()
