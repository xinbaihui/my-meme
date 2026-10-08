# No dependency workspace: each component owns its dependencies.
PYTHON ?= python3
BACKEND_PYTHON ?= backend/.venv/bin/python
PLUGIN_DIR := plugin
.DEFAULT_GOAL := help
.PHONY: help dev-dsh install install-frontend install-backend install-plugin dev-frontend dev-backend build build-frontend build-plugin test-frontend lint-frontend eval smoke
help:
	@echo "Install: make install (or install-frontend / install-backend / install-plugin)"
	@echo "Demo: make dev-frontend and make dev-dsh in separate terminals; legacy API: make dev-backend"
	@echo "Check: make build / test-frontend / lint-frontend / eval / smoke"
install: install-frontend install-backend install-plugin
install-frontend:
	cd frontend && npm ci
install-backend:
	$(PYTHON) -c 'import sys; sys.version_info >= (3, 10) or sys.exit("Python 3.10+ required; set PYTHON to a suitable interpreter")'
	$(PYTHON) -m venv backend/.venv
	$(BACKEND_PYTHON) -m pip install -r backend/requirements.txt
install-plugin:
	cd $(PLUGIN_DIR) && pnpm install --frozen-lockfile
dev-frontend:
	cd frontend && npm run dev
dev-backend:
	$(BACKEND_PYTHON) -m uvicorn backend.app.main:app --reload --port 8000
build: build-frontend build-plugin
build-frontend:
	cd frontend && npm run build
build-plugin:
	cd $(PLUGIN_DIR) && pnpm run build
test-frontend:
	cd frontend && npm test
lint-frontend:
	cd frontend && npm run lint
eval:
	$(BACKEND_PYTHON) evals/run-suite.py
smoke:
	$(BACKEND_PYTHON) sdk-smoke.py

dev-dsh:
	node scripts/start-dsh.mjs
