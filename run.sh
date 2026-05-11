#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${1:-8000}"

echo "Starting Head Pose Viewer at http://localhost:${PORT}/"
echo "Press Ctrl+C to stop."

if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "${PORT}"
elif command -v python >/dev/null 2>&1; then
  python -m http.server "${PORT}"
else
  echo "Python is required on Linux/macOS for this launcher."
  echo "Please install Python 3, then run ./run.sh again."
  exit 1
fi
