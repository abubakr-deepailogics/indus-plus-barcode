"""Start the QR scanner backend on Windows — the `npm run dev` / `npm start` of this service.

From the repo root:   npm run qr:dev     /  npm run qr:start
Or from this folder:  py -3.12 run.py dev  /  py -3.12 run.py start

First run creates .venv and installs requirements.txt; later runs reinstall
only when requirements.txt changes.
Env overrides: HOST (default 127.0.0.1), PORT (8080), WORKERS (1, start only).
More than 1 worker is flaky on Windows (uvicorn socket sharing: WinError 10022),
and one worker already scans photos concurrently (run_in_threadpool in routes.py).
"""

import os
import subprocess
import sys
import venv
from pathlib import Path

ROOT = Path(__file__).resolve().parent
VENV = ROOT / ".venv"
PY = VENV / "Scripts" / "python.exe"
REQS = ROOT / "requirements.txt"
STAMP = VENV / ".requirements-installed"


def ensure_env():
    if not PY.exists():
        print("Creating .venv ...")
        venv.create(VENV, with_pip=True)
    if not STAMP.exists() or STAMP.stat().st_mtime < REQS.stat().st_mtime:
        print("Installing requirements ...")
        subprocess.run([str(PY), "-m", "pip", "install", "-r", str(REQS)], check=True)
        STAMP.touch()  # only after a successful install, so a failed one retries next run


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode not in ("dev", "start"):
        sys.exit("usage: py -3.12 run.py dev|start")

    ensure_env()
    cmd = [
        str(PY), "-m", "uvicorn", "app.main:app",
        "--host", os.getenv("HOST", "127.0.0.1"),
        "--port", os.getenv("PORT", "8080"),
    ]
    cmd += ["--reload", "--reload-dir", "app"] if mode == "dev" else ["--workers", os.getenv("WORKERS", "1")]

    # Ctrl+C reaches every process in the console, so uvicorn is already
    # shutting down; wait for it instead of killing it mid-way.
    proc = subprocess.Popen(cmd, cwd=ROOT)
    while True:
        try:
            sys.exit(proc.wait())
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        sys.exit(f"pip install failed (exit {e.returncode}); fix the error above and run again.")
