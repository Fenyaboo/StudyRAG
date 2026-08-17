#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

printf '%s\n' "StudyRAG local development commands"
printf '%s\n' "Terminal 1: uvicorn app.main:app --reload --app-dir \"${ROOT_DIR}/backend\""
printf '%s\n' "Terminal 2: npm --prefix \"${ROOT_DIR}/frontend\" run dev"
printf '%s\n' "Backend health: http://localhost:8000/api/v1/health"
printf '%s\n' "Frontend: http://localhost:5173"
