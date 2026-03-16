# ============================================================
# RAG Data Collector — Distribution Build Script (Windows)
# ============================================================
# Builds the frontend, then cross-compiles the Go backend for
# Windows (amd64) and Linux (amd64), and packages each into a
# self-contained ZIP archive under dist/.
#
# Requirements:
#   - Node.js + npm  (for the React frontend)
#   - Go 1.22+       (for the backend binary)
#   - PowerShell 5+
#
# Usage:
#   .\build.ps1
# ============================================================

$ErrorActionPreference = 'Stop'

$ROOT      = $PSScriptRoot
$FRONTEND  = Join-Path $ROOT "frontend"
$BACKEND   = Join-Path $ROOT "backend"
$DIST      = Join-Path $ROOT "dist"
$VERSION   = "1.0.0"
$APP_NAME  = "rag-data-collector"

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  RAG Data Collector - Distribution Build   " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ── 1. Build frontend ──────────────────────────────────────
Write-Host "[1/4] Building React frontend..." -ForegroundColor Yellow

$npm = $null
foreach ($candidate in @("npm", "node")) {
    if (Get-Command $candidate -ErrorAction SilentlyContinue) {
        $npm = $candidate; break
    }
}

# Support nvm4w layout
$npmCli = "C:\nvm4w\nodejs\node_modules\npm\bin\npm-cli.js"
if (Test-Path $npmCli) {
    Push-Location $FRONTEND
    node $npmCli run build
    Pop-Location
} elseif (Get-Command npm -ErrorAction SilentlyContinue) {
    Push-Location $FRONTEND
    npm run build
    Pop-Location
} else {
    Write-Error "npm not found. Install Node.js and ensure npm is in PATH."
}

Write-Host "  Frontend built -> backend/ui/" -ForegroundColor Green

# ── 2. Prepare dist directory ─────────────────────────────
Write-Host "[2/4] Preparing dist directory..." -ForegroundColor Yellow
if (Test-Path $DIST) { Remove-Item $DIST -Recurse -Force }
New-Item -ItemType Directory -Path $DIST | Out-Null

# ── 3. Build binaries ─────────────────────────────────────
Write-Host "[3/4] Compiling Go binaries..." -ForegroundColor Yellow

$targets = @(
    @{ OS = "windows"; ARCH = "amd64"; EXT = ".exe" },
    @{ OS = "linux";   ARCH = "amd64"; EXT = ""     }
)

foreach ($t in $targets) {
    $label   = "$($t.OS)/$($t.ARCH)"
    $outName = "${APP_NAME}$($t.EXT)"
    $outDir  = Join-Path $DIST "${APP_NAME}-$VERSION-$($t.OS)-$($t.ARCH)"
    New-Item -ItemType Directory -Path $outDir | Out-Null

    Write-Host "  Building $label..." -ForegroundColor Gray

    $env:GOOS   = $t.OS
    $env:GOARCH = $t.ARCH
    $env:CGO_ENABLED = "0"

    Push-Location $BACKEND
    go build -ldflags="-s -w -X main.Version=$VERSION" -o (Join-Path $outDir $outName) .
    Pop-Location

    # Remove env vars so they don't leak
    Remove-Item Env:\GOOS, Env:\GOARCH, Env:\CGO_ENABLED -ErrorAction SilentlyContinue

    # ── Copy support files ──────────────────────────────────
    $envDst = Join-Path $outDir ".env.example"
    Copy-Item (Join-Path $BACKEND ".env.example") $envDst

    # Startup guide
    if ($t.OS -eq "windows") {
        $startScript = Join-Path $outDir "start.bat"
        @"
@echo off
REM -- RAG Data Collector startup --
REM Copy .env.example to .env and set your JWT_SECRET before first run.

if not exist ".env" (
    copy .env.example .env
    echo Created .env from example. Edit it before continuing.
    pause
)
${APP_NAME}.exe
"@ | Set-Content $startScript -Encoding ASCII
    } else {
        $startScript = Join-Path $outDir "start.sh"
        @"
#!/bin/sh
# RAG Data Collector startup
# Copy .env.example to .env and set your JWT_SECRET before first run.
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from example. Edit JWT_SECRET before continuing."
fi
./${APP_NAME}
"@ | Set-Content $startScript -Encoding UTF8
    }

    # README snippet
    $readme = Join-Path $outDir "README.txt"
    @"
RAG Data Collector v$VERSION — $($t.OS.ToUpper()) $($t.ARCH.ToUpper())
=====================================================================

Quick Start
-----------
1. Copy .env.example to .env
2. Set a strong JWT_SECRET (min 32 random characters)
3. Adjust other settings (port, upload dir, etc.) if needed
4. Run the binary:
$(if ($t.OS -eq "windows") { "   start.bat  (or double-click $outName)" } else { "   chmod +x $($APP_NAME) start.sh && ./start.sh" })

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
"@ | Set-Content $readme -Encoding UTF8

    Write-Host "  Built: $outDir" -ForegroundColor Green
}

# ── 4. Package as ZIPs ────────────────────────────────────
Write-Host "[4/4] Packaging ZIP archives..." -ForegroundColor Yellow

Get-ChildItem $DIST -Directory | ForEach-Object {
    $zipPath = "$($_.FullName).zip"
    Compress-Archive -Path "$($_.FullName)\*" -DestinationPath $zipPath -Force
    $sizeMB = [Math]::Round((Get-Item $zipPath).Length / 1MB, 2)
    Write-Host "  $([System.IO.Path]::GetFileName($zipPath))  ($sizeMB MB)" -ForegroundColor Green
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Build complete!  Artifacts in: dist/      " -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
