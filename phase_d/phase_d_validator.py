from main_pipeline import run_pipeline
from collections import Counter
import json

class PhaseDValidator:

    def __init__(self):
        self.results = []
        self.procedure_counter = Counter()
        self.intent_counter = Counter()
        self.stage_counter = Counter()
        self.errors = []

    def run_tests(self):
        test_inputs = [
            "อยากหน้าเรียว", "Botox ดีไหม", "filler คืออะไร",
            "มีโปรไหม", "ทำอันไหนดีระหว่าง filler กับ botox",
            "กลัวเจ็บ", "ช่วยแนะนำหน่อย", "มีรีวิวไหม",
            "ต้องพักฟื้นไหม", "ราคาเท่าไหร่", "ฉีดแล้วอยู่ได้นานไหม",
            "อยากยกกระชับหน้า", "มีตัวไหนเห็นผลเร็ว",
            "Ultraformer ดีไหม", "Thermage ต่างจาก Hifu ยังไง",
            "อยากจองคิว Botox เลย",
            "ตัดสินใจทำ filler แล้ว",
            "สนใจทำ Ulthera",
            "อยากลดกราม",
            "ปัญหาสิว",
            "อยากลดไขมันใต้คาง",
            "ผมร่วงมากทำยังไงดี",
            "อยากทำเลเซอร์ฝ้า"
        
        ]
        for text in test_inputs:
            try:
                result = run_pipeline(text)
                self.validate_result(text, result)
                self.collect_stats(result)
                self.results.append(result)
            except Exception as e:
                self.errors.append({"input": text, "error": str(e)})

    def validate_result(self, text, result):
        required_keys = ["response", "cta", "recommendations"]
        for key in required_keys:
            if key not in result:
                self.errors.append({"input": text, "error": f"Missing key: {key}"})
        if not result.get("response"):
            self.errors.append({"input": text, "error": "Empty response"})

    def collect_stats(self, result):
        self.intent_counter[result.get("intent")] += 1
        self.stage_counter[result.get("stage")] += 1
        for r in result.get("recommendations", []):
            self.procedure_counter[r["procedure_id"]] += 1

    def generate_report(self):
        return {
            "total_tests": len(self.results),
            "errors": self.errors,
            "intent_distribution": dict(self.intent_counter),
            "stage_distribution": dict(self.stage_counter),
            "top_procedures": self.procedure_counter.most_common(10),
            "unique_procedures": len(self.procedure_counter)
        }

    def print_report(self, report):
        print("\n" + "="*50)
        print("PHASE D VALIDATION REPORT")
        print("="*50)
        print(f"\nTotal tests: {report['total_tests']}")
        print(f"Errors: {len(report['errors'])}")
        if report["errors"]:
            print("\nErrors:")
            for e in report["errors"]:
                print("-", e)
        print("\nIntent Distribution:")
        for k, v in report["intent_distribution"].items():
            print(f"  {k}: {v}")
        print("\nStage Distribution:")
        for k, v in report["stage_distribution"].items():
            print(f"  {k}: {v}")
        print("\nTop Procedures:")
        for proc, count in report["top_procedures"]:
            print(f"  {proc}: {count}")
        print(f"\nUnique Procedures Used: {report['unique_procedures']}")
        print("\n" + "="*50)

    def save_report(self, report):
        with open("phase_d_report.json", "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    validator = PhaseDValidator()
    validator.run_tests()
    report = validator.generate_report()
    validator.print_report(report)
    validator.save_report(report)
