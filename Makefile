# No dependency workspace: frontend, Python tools, and plugin install separately.
PYTHON ?= python3
PYTHON_BIN ?= .venv/bin/python
PLUGIN_DIR := plugin
.DEFAULT_GOAL := help
.PHONY: help dev-dsh install install-frontend install-python install-plugin dev-frontend build build-frontend build-plugin test-frontend lint-frontend eval smoke
help:
	@echo "Install: make install (or install-frontend / install-python / install-plugin)"
	@echo "Demo: make dev-frontend and make dev-dsh in separate terminals"
	@echo "Check: make build / test-frontend / lint-frontend / eval / smoke"
install: install-frontend install-python install-plugin
install-frontend:
	cd frontend && npm ci
install-python:
	$(PYTHON) -c 'import sys; sys.version_info >= (3, 10) or sys.exit("Python 3.10+ required; set PYTHON to a suitable interpreter")'
	$(PYTHON) -m venv .venv
	$(PYTHON_BIN) -m pip install -r requirements.txt
install-plugin:
	cd $(PLUGIN_DIR) && pnpm install --frozen-lockfile
dev-frontend:
	cd frontend && npm run dev
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
	$(PYTHON_BIN) evals/run-suite.py
smoke:
	$(PYTHON_BIN) sdk-smoke.py

dev-dsh:
	node scripts/start-dsh.mjs
