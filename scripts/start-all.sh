#!/usr/bin/env bash
# ==============================================================================
# NEXUS CITY + AETHER CONVERGENCE LAUNCHER
# Starts the local Python AI Server (localhost:8000) and Next.js Web (localhost:3000)
# ==============================================================================

set -euo pipefail

AETHER_ROOT="/home/blu/Projects/AETHER"
NEXUS_ROOT="/home/blu/Projects/nexus-sky"
VENV_PY="$NEXUS_ROOT/nexus-ai/.venv/bin/python"

echo "=========================================================="
echo " Starting NEXUS AI + AETHER CITY Unified Development Stack"
echo "=========================================================="

# Check Python environment
if [ ! -f "$VENV_PY" ]; then
  echo "Error: Python venv not found at $VENV_PY"
  exit 1
fi

# Cleanup on exit
cleanup() {
  echo ""
  echo "Stopping all services..."
  if [ -n "${PY_PID:-}" ]; then
    kill "$PY_PID" 2>/dev/null || true
  fi
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# Free port 8000 if already bound
if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Freeing port 8000..."
  fuser -k 8000/tcp 2>/dev/null || true
  sleep 1
fi

echo "[1/2] Starting NEXUS AI Backend (FastAPI on 127.0.0.1:8000)..."
cd "$NEXUS_ROOT"
export PYTHONPATH="$NEXUS_ROOT"
"$VENV_PY" -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --log-level warning &
PY_PID=$!

echo "Waiting for NEXUS AI Backend health check..."
MAX_RETRIES=20
COUNT=0
while [ $COUNT -lt $MAX_RETRIES ]; do
  if curl -s "http://127.0.0.1:8000/api/nexus/health" >/dev/null 2>&1; then
    echo "✔ NEXUS AI Backend is ONLINE."
    break
  fi
  sleep 0.5
  COUNT=$((COUNT + 1))
done

if [ $COUNT -eq $MAX_RETRIES ]; then
  echo "⚠ Warning: NEXUS Backend health check timed out. Proceeding in fallback mode."
fi

echo "[2/2] Starting AETHER CITY Next.js Web on http://localhost:3000..."
cd "$AETHER_ROOT"
export NEXUS_BACKEND_URL="http://127.0.0.1:8000"
exec npm run dev
