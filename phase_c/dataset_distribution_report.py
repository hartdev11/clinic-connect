import yaml
import os
from collections import Counter

DATASET_PATH = "dataset"

def load_yaml(file):
    with open(os.path.join(DATASET_PATH, file), "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

def count_procedure_usage():
    files = [
        "comparisons.yaml",
        "consultations.yaml",
        "objections.yaml",
        "treatment_packages.yaml"
    ]
    counter = Counter()
    for file in files:
        data = load_yaml(file)
        items = data if isinstance(data, list) else data.get("packages", [])
        for item in items:
            if "related_procedure" in item:
                counter[item["related_procedure"]] += 1
            if "procedures" in item:
                for p in item["procedures"]:
                    counter[p] += 1
            if "items" in item:
                for p in item["items"]:
                    counter[p] += 1
            if "recommended_procedures" in item:
                for p in item["recommended_procedures"]:
                    counter[p] += 1
    return counter

def main():
    usage = count_procedure_usage()
    print("\n📊 Procedure Usage Report:\n")
    for proc, count in usage.most_common(20):
        print(f"  {proc}: {count}")
    print(f"\nTotal unique procedures used: {len(usage)}")

if __name__ == "__main__":
    main()
