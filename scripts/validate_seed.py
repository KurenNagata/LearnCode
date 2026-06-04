#!/usr/bin/env python3
"""seed の各問題の answer_code を Piston で実行し、隠しテストの期待出力と一致するか検証する。

使い方:
  python scripts/validate_seed.py            # 全言語(api/seed配下)を検証
  python scripts/validate_seed.py c java      # 指定言語のみ

判定は judge.go と同じ正規化（末尾改行除去 + 全角！→半角!）で比較する。
"""
import json
import os
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor

WORKERS = int(os.environ.get("VALIDATE_WORKERS", "12"))

PISTON_URL = os.environ.get("PISTON_URL", "http://localhost:2000")
SEED_DIR = os.path.join(os.path.dirname(__file__), "..", "api", "seed")


def normalize(s: str) -> str:
    return s.rstrip("\r\n").replace("！", "!")


def execute(language: str, code: str, stdin: str):
    filename = "main.py" if language == "python" else f"main.{language}"
    body = {
        "language": language,
        "version": "*",
        "files": [{"name": filename, "content": code}],
        "stdin": stdin,
        "run_timeout": 3000,
        "compile_timeout": 10000,
    }
    req = urllib.request.Request(
        f"{PISTON_URL}/api/v2/execute",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def main():
    langs = sys.argv[1:] or sorted(
        d for d in os.listdir(SEED_DIR) if os.path.isdir(os.path.join(SEED_DIR, d))
    )
    jobs = []  # (lang, file, i, language, code, tc)
    for lang in langs:
        ldir = os.path.join(SEED_DIR, lang)
        files = sorted(f for f in os.listdir(ldir) if f.endswith(".json"))
        for f in files:
            with open(os.path.join(ldir, f), encoding="utf-8") as fh:
                prob = json.load(fh)
            for i, tc in enumerate(prob["test_cases"]):
                jobs.append((lang, f, i, prob["language"], prob["answer_code"], tc))

    def run_job(job):
        lang, f, i, language, code, tc = job
        try:
            res = execute(language, code, tc["stdin"])
        except Exception as e:  # noqa: BLE001
            return (lang, f, i, "EXEC ERROR", str(e))
        comp = res.get("compile", {})
        if comp and comp.get("code", 0) != 0:
            return (lang, f, i, "COMPILE", comp.get("stderr", "")[:200])
        run = res.get("run", {})
        actual = normalize(run.get("stdout", ""))
        expected = normalize(tc["stdout"])
        if actual == expected and run.get("code", 1) == 0:
            return None
        detail = f"want={expected!r} got={actual!r} code={run.get('code')} stderr={run.get('stderr','')[:120]!r}"
        return (lang, f, i, "MISMATCH", detail)

    total = len(jobs)
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        results = list(ex.map(run_job, jobs))
    failures = [r for r in results if r is not None]
    failures.sort(key=lambda r: (r[0], r[1], r[2]))
    passed = total - len(failures)

    print(f"\n=== {passed}/{total} passed ===")
    if failures:
        print(f"--- {len(failures)} FAILURES ---")
        for lang, f, i, kind, detail in failures:
            print(f"[{kind}] {lang}/{f} test#{i}: {detail}")
        sys.exit(1)
    print("ALL GREEN")


if __name__ == "__main__":
    main()
