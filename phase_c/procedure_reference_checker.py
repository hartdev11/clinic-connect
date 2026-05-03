import yaml
import os

DATASET_PATH = "dataset"

def load_yaml(file):
    with open(os.path.join(DATASET_PATH, file), "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def get_procedure_ids():
    data = load_yaml("procedures.yaml")
    return set(item["id"] for item in data)

def check_references(file_name, procedure_ids):
    data = load_yaml(file_name)
    items = data if isinstance(data, list) else data.get("packages", [])
    print(f"\nChecking references in {file_name}...")
    errors = 0
    for item in items:
        if "related_procedure" in item:
            if item["related_procedure"] not in procedure_ids:
                print(f"❌ Invalid reference: {item['related_procedure']} in {item['id']}")
                errors += 1
        if "procedures" in item:
            for p in item["procedures"]:
                if p not in procedure_ids:
                    print(f"❌ Invalid procedure: {p} in {item['id']}")
                    errors += 1
        if "items" in item:
            for p in item["items"]:
                if p not in procedure_ids:
                    print(f"❌ Invalid procedure: {p} in {item['id']}")
                    errors += 1
        if "recommended_procedures" in item:
            for p in item["recommended_procedures"]:
                if p not in procedure_ids:
                    print(f"❌ Invalid procedure: {p} in {item['id']}")
                    errors += 1
    if errors == 0:
        print(f"✅ Reference check done for {file_name} — no errors")
    else:
        print(f"⚠️ {errors} errors in {file_name}")

def main():
    procedure_ids = get_procedure_ids()
    files = [
        "comparisons.yaml",
        "consultations.yaml",
        "objections.yaml",
        "treatment_packages.yaml"
    ]
    for f in files:
        check_references(f, procedure_ids)

if __name__ == "__main__":
    main()
