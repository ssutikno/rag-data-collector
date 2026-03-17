#!/bin/sh
# RAG Data Collector startup
# Copy .env.example to .env and set your JWT_SECRET before first run.
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from example. Edit JWT_SECRET before continuing."
fi
./rag-data-collector
