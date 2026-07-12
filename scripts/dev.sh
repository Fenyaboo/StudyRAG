#!/usr/bin/env bash
# Script chạy song song Backend & Frontend không cần Docker

set -e

echo "🌌 [StudyRAG] Khởi động hệ thống Thiên văn (No-Docker Mode)..."

# 1. Kiểm tra / tạo môi trường ảo Python cho backend
if [ ! -d "backend/.venv" ]; then
  echo "📦 Đang thiết lập virtualenv cho backend..."
  python3 -m venv backend/.venv
  backend/.venv/bin/pip install -q --upgrade pip
  backend/.venv/bin/pip install -q -r <(cd backend && backend/.venv/bin/pip install -e .)
fi

# 2. Khởi động Backend FastAPI ở background (:8000)
echo "🚀 Đang bật trạm Backend FastAPI tại http://localhost:8000..."
cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd ..

# 3. Khởi động Frontend Vite (:5173)
echo "✨ Đang bật giao diện Frontend tại http://localhost:5173..."
cd frontend
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run dev &
FRONTEND_PID=$!
cd ..

# Hàm dọn dẹp khi nhấn Ctrl+C
cleanup() {
  echo ""
  echo "🛑 Đang tắt trạm StudyRAG (PIDs: $BACKEND_PID $FRONTEND_PID)..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "================================================================"
echo "🔭 TRẠM THIÊN VĂN STUDYRAG ĐÃ SẴN SÀNG:"
echo "👉 Frontend Giao diện: http://localhost:5173"
echo "👉 Backend API Docs  : http://localhost:8000/docs"
echo "👉 Nhấn Ctrl + C để tắt toàn bộ trạm."
echo "================================================================"

wait
