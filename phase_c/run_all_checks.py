import subprocess
import sys

scripts = [
    "dataset_validator.py",
    "procedure_reference_checker.py",
    "dataset_distribution_report.py"
]

for script in scripts:
    print(f"\n===== Running {script} =====")
    subprocess.run([sys.executable, script])

print("\n===== ALL CHECKS COMPLETE =====")
