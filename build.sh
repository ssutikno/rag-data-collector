#!/usr/bin/env bash
# ============================================================
# RAG Data Collector — Distribution Build Script (Linux/macOS)
# ============================================================
# Builds the frontend, then cross-compiles the Go backend for
# Windows (amd64) and Linux (amd64), and packages each into a
# self-contained archive under dist/.
#
# Requirements:
#   - Node.js + npm  (for the React frontend)
#   - Go 1.22+       (for the backend binary)
#
# Usage:
#   chmod +x build.sh && ./build.sh
# ============================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
DIST="$ROOT/dist"
VERSION="1.0.0"
APP_NAME="rag-data-collector"

CYAN='\033[0;36m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; GRAY='\033[0;37m'; NC='\033[0m'

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  RAG Data Collector — Distribution Build  ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""

# ── 1. Build frontend ──────────────────────────────────────
echo -e "${YELLOW}[1/4] Building React frontend...${NC}"
cd "$FRONTEND"
npm run build
cd "$ROOT"
echo -e "${GREEN}  Frontend built -> backend/ui/${NC}"

# ── 2. Prepare dist directory ─────────────────────────────
echo -e "${YELLOW}[2/4] Preparing dist directory...${NC}"
rm -rf "$DIST"
mkdir -p "$DIST"

# ── 3. Build binaries ─────────────────────────────────────
echo -e "${YELLOW}[3/4] Compiling Go binaries...${NC}"

build_target() {
    local GOOS_VAL=$1
    local GOARCH_VAL=$2
    local EXT=$3

    local LABEL="${GOOS_VAL}/${GOARCH_VAL}"
    local OUT_NAME="${APP_NAME}${EXT}"
    local OUT_DIR="${DIST}/${APP_NAME}-${VERSION}-${GOOS_VAL}-${GOARCH_VAL}"

    echo -e "${GRAY}  Building ${LABEL}...${NC}"
    mkdir -p "$OUT_DIR"

    GOOS=$GOOS_VAL GOARCH=$GOARCH_VAL CGO_ENABLED=0 \
        go build -ldflags="-s -w -X main.Version=${VERSION}" \
        -o "${OUT_DIR}/${OUT_NAME}" "$BACKEND"

    # Support files
    cp "$BACKEND/.env.example" "$OUT_DIR/.env.example"

    # Startup script
    if [ "$GOOS_VAL" = "windows" ]; then
        cat > "${OUT_DIR}/start.bat" << 'WBAT'
@echo off
REM -- RAG Data Collector startup --
REM Copy .env.example to .env and set your JWT_SECRET before first run.
if not exist ".env" (
    copy .env.example .env
    echo Created .env from example. Edit it before continuing.
    pause
)
rag-data-collector.exe
WBAT
    else
        cat > "${OUT_DIR}/start.sh" << 'SH'
#!/bin/sh
# RAG Data Collector startup
# Copy .env.example to .env and set your JWT_SECRET before first run.
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from example. Edit JWT_SECRET before continuing."
fi
./rag-data-collector
SH
        chmod +x "${OUT_DIR}/start.sh"
    fi

    # README
    cat > "${OUT_DIR}/README.txt" << EOF
RAG Data Collector v${VERSION} — $(echo "$GOOS_VAL" | tr '[:lower:]' '[:upper:]') ${GOARCH_VAL^^}
=====================================================================

Quick Start
-----------
1. Copy .env.example to .env
2. Set a strong JWT_SECRET (min 32 random characters)
   Generate one with: openssl rand -base64 48
3. Adjust other settings (port, upload dir, etc.) if needed
4. Run the binary:
$([ "$GOOS_VAL" = "windows" ] && echo "   start.bat  (or double-click rag-data-collector.exe)" || echo "   chmod +x rag-data-collector start.sh && ./start.sh")

The app will be available at http://localhost:8080

Default Admin Credentials (first run only)
-------------------------------------------
  Email   : admin@example.com
  Password: Admin@123

Change the admin password immediately after first login.

Configuration (.env)
--------------------
  DB_PATH          Path to SQLite database file   (default: ./app.db)
  JWT_SECRET       Secret key for JWT signing      (!!! CHANGE THIS !!!)
  JWT_EXPIRY_HOURS Token lifetime in hours         (default: 8)
  UPLOAD_DIR       Directory for uploaded files    (default: ./uploads)
  MAX_FILE_SIZE_MB Max upload size in MB           (default: 100)
  SERVER_PORT      HTTP listen port                (default: 8080)
EOF

    echo -e "${GREEN}  Built: ${OUT_DIR}${NC}"
}

build_target "windows" "amd64" ".exe"
build_target "linux"   "amd64" ""

# ── 4. Package archives ───────────────────────────────────
echo -e "${YELLOW}[4/4] Packaging archives...${NC}"

for dir in "$DIST"/*/; do
    base="$(basename "$dir")"
    if [[ "$base" == *"-windows-"* ]]; then
        zip_path="${DIST}/${base}.zip"
        (cd "$dir" && zip -qr "$zip_path" .)
        size=$(du -sh "$zip_path" | cut -f1)
        echo -e "${GREEN}  ${base}.zip  (${size})${NC}"
    else
        tar_path="${DIST}/${base}.tar.gz"
        tar -czf "$tar_path" -C "$DIST" "$base"
        size=$(du -sh "$tar_path" | cut -f1)
        echo -e "${GREEN}  ${base}.tar.gz  (${size})${NC}"
    fi
done

echo ""
echo -e "${CYAN}============================================${NC}"
echo -e "${CYAN}  Build complete!  Artifacts in: dist/     ${NC}"
echo -e "${CYAN}============================================${NC}"
echo ""
