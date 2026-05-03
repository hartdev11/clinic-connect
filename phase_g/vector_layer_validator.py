from __future__ import annotations

from vector_health_check import VectorHealthCheckService


if __name__ == "__main__":
    res = VectorHealthCheckService().run_full_health_check()
    print(res)
    if res.get("success"):
        print("FINAL RESULT: PASS")
    else:
        print("FINAL RESULT: FAIL")
