@echo off
REM -- RAG Data Collector startup --
REM Copy .env.example to .env and set your JWT_SECRET before first run.

if not exist ".env" (
    copy .env.example .env
    echo Created .env from example. Edit it before continuing.
    pause
)
rag-data-collector.exe
