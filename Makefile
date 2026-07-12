.PHONY: help setup dev test evaluate clean

help:
	@echo "StudyRAG V2 Local Commands:"
	@echo "  make setup     - Cài đặt dependency cho cả Backend và Frontend"
	@echo "  make start     - Chạy song song Backend & Frontend TRỰC TIẾP (Không cần Docker)"
	@echo "  make dev       - Chạy song song qua Docker Compose"
	@echo "  make test      - Chạy unit/integration test cho cả Backend và Frontend"
	@echo "  make evaluate  - Chạy script đánh giá retrieval"
	@echo "  make clean     - Dọn dẹp cache và file tạm"

setup:
	@echo "Setting up Backend..."
	cd backend && python3 -m venv .venv || true
	cd backend && .venv/bin/pip install --upgrade pip
	cd backend && .venv/bin/pip install -e '.[dev]'
	@echo "Setting up Frontend..."
	cd frontend && npm install
	@echo "Setup complete!"

start:
	@chmod +x scripts/dev.sh
	@./scripts/dev.sh

dev:
	@echo "Starting dev servers with Docker Compose..."
	docker-compose up --build

test:
	@echo "Running Backend tests..."
	cd backend && pytest -v
	@echo "Running Frontend tests..."
	cd frontend && npm test -- --run

evaluate:
	@echo "Running retrieval evaluation script..."
	python3 scripts/evaluate_retrieval.py

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	rm -rf backend/.coverage backend/htmlcov
	rm -rf frontend/dist
