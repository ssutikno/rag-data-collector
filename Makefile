# ============================================================
# RAG Data Collector — Makefile
# ============================================================
# Targets:
#   make dev        — build frontend + run backend in dev mode
#   make build      — build frontend + compile current-OS binary
#   make dist       — build frontend + cross-compile all platforms
#   make dist-win   — build Windows amd64 only
#   make dist-linux — build Linux amd64 only
#   make clean      — remove build outputs
# ============================================================

APP_NAME  := rag-data-collector
VERSION   := 1.0.0
FRONTEND  := ./frontend
BACKEND   := ./backend
DIST      := ./dist
LDFLAGS   := -s -w -X main.Version=$(VERSION)

# Detect OS for default binary extension
ifeq ($(OS),Windows_NT)
	BINARY_EXT := .exe
else
	BINARY_EXT :=
endif

.PHONY: all dev build dist dist-win dist-linux frontend clean help

all: build

## help: Show this help message
help:
	@echo ""
	@echo "RAG Data Collector — Build Targets"
	@echo "-----------------------------------"
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  /'
	@echo ""

## frontend: Build the React frontend into backend/ui/
frontend:
	@echo "[frontend] Building React app..."
	cd $(FRONTEND) && npm run build
	@echo "[frontend] Done -> backend/ui/"

## build: Build frontend + compile for the current OS
build: frontend
	@echo "[build] Compiling $(APP_NAME) for current OS..."
	cd $(BACKEND) && CGO_ENABLED=0 go build \
		-ldflags="$(LDFLAGS)" \
		-o $(APP_NAME)$(BINARY_EXT) .
	@echo "[build] Binary: backend/$(APP_NAME)$(BINARY_EXT)"

## dev: Build frontend then run backend in development mode
dev: frontend
	@echo "[dev] Starting backend on :8080..."
	cd $(BACKEND) && go run .

## dist: Build frontend + cross-compile for all platforms + package
dist: frontend dist-win dist-linux
	@echo ""
	@echo "All distribution archives are in: $(DIST)/"

## dist-win: Build Windows amd64 distribution
dist-win:
	@echo "[dist] windows/amd64..."
	@mkdir -p $(DIST)/$(APP_NAME)-$(VERSION)-windows-amd64
	cd $(BACKEND) && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build \
		-ldflags="$(LDFLAGS)" \
		-o ../$(DIST)/$(APP_NAME)-$(VERSION)-windows-amd64/$(APP_NAME).exe .
	@cp $(BACKEND)/.env.example $(DIST)/$(APP_NAME)-$(VERSION)-windows-amd64/.env.example
	@echo "@echo off\nif not exist \".env\" copy .env.example .env\n$(APP_NAME).exe" \
		> $(DIST)/$(APP_NAME)-$(VERSION)-windows-amd64/start.bat
	@cd $(DIST) && zip -qr $(APP_NAME)-$(VERSION)-windows-amd64.zip \
		$(APP_NAME)-$(VERSION)-windows-amd64/
	@echo "  -> $(DIST)/$(APP_NAME)-$(VERSION)-windows-amd64.zip"

## dist-linux: Build Linux amd64 distribution
dist-linux:
	@echo "[dist] linux/amd64..."
	@mkdir -p $(DIST)/$(APP_NAME)-$(VERSION)-linux-amd64
	cd $(BACKEND) && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
		-ldflags="$(LDFLAGS)" \
		-o ../$(DIST)/$(APP_NAME)-$(VERSION)-linux-amd64/$(APP_NAME) .
	@cp $(BACKEND)/.env.example $(DIST)/$(APP_NAME)-$(VERSION)-linux-amd64/.env.example
	@printf '#!/bin/sh\n[ ! -f .env ] && cp .env.example .env\n./$(APP_NAME)\n' \
		> $(DIST)/$(APP_NAME)-$(VERSION)-linux-amd64/start.sh
	@chmod +x $(DIST)/$(APP_NAME)-$(VERSION)-linux-amd64/start.sh \
		       $(DIST)/$(APP_NAME)-$(VERSION)-linux-amd64/$(APP_NAME) 2>/dev/null || true
	@cd $(DIST) && tar -czf $(APP_NAME)-$(VERSION)-linux-amd64.tar.gz \
		$(APP_NAME)-$(VERSION)-linux-amd64/
	@echo "  -> $(DIST)/$(APP_NAME)-$(VERSION)-linux-amd64.tar.gz"

## clean: Remove dist/ and compiled binaries
clean:
	@echo "[clean] Removing dist/ and binaries..."
	@rm -rf $(DIST)
	@rm -f $(BACKEND)/$(APP_NAME) $(BACKEND)/$(APP_NAME).exe
	@echo "[clean] Done."
