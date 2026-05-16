#!/usr/bin/env bash
set -euo pipefail

echo "[entrypoint] aguardando banco em ${POSTGRES_HOST}:${POSTGRES_PORT}..."
python - <<'PY'
import os, socket, time, sys
host = os.environ.get("POSTGRES_HOST", "db")
port = int(os.environ.get("POSTGRES_PORT", "5432"))
deadline = time.time() + 60
while time.time() < deadline:
    try:
        with socket.create_connection((host, port), timeout=2):
            print(f"[entrypoint] banco respondeu em {host}:{port}")
            sys.exit(0)
    except OSError:
        time.sleep(1)
print("[entrypoint] timeout aguardando banco", file=sys.stderr)
sys.exit(1)
PY

echo "[entrypoint] aplicando migrations..."
alembic upgrade head

echo "[entrypoint] executando seed (idempotente)..."
python -m app.db.seed

if [ "${APP_ENV:-development}" = "production" ]; then
  echo "[entrypoint] iniciando gunicorn..."
  exec gunicorn app.main:app \
      -k uvicorn.workers.UvicornWorker \
      -w "${WEB_CONCURRENCY:-4}" \
      -b 0.0.0.0:8000 \
      --access-logfile - \
      --error-logfile -
else
  echo "[entrypoint] iniciando uvicorn (reload off)..."
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000
fi
