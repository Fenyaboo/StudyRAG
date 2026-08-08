.PHONY: install backend-install frontend-install dev test lint build migrate

VENV ?= .venv
PYTHON := $(VENV)/bin/python

install: backend-install frontend-install

$(VENV)/bin/python:
	python3 -m venv $(VENV)

backend-install: $(VENV)/bin/python
	$(PYTHON) -m pip install -r backend/requirements.txt

frontend-install:
	npm --prefix frontend install

dev:
	@echo "Run backend and frontend in separate terminals:"
	@echo "  PYTHONPATH=backend $(VENV)/bin/uvicorn app.main:app --reload"
	@echo "  npm --prefix frontend run dev"

test: backend-install
	PYTHONPATH=backend $(PYTHON) -m pytest -q backend/tests

lint: backend-install
	PYTHONPATH=backend $(PYTHON) -m compileall -q backend/app backend/tests scripts
	npm --prefix frontend run lint

build:
	npm --prefix frontend run build

migrate:
	@echo "Apply supabase/migrations/001_init.sql in Supabase SQL Editor or via Supabase CLI."
