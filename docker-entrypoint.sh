#!/bin/bash
set -e

# LingEcho Docker Entrypoint Script
# This script handles initialization and startup of the LingEcho application

echo "=========================================="
echo "LingEcho Application Starting..."
echo "=========================================="

# Check if database file exists, create directory if needed
if [ ! -d "./data" ]; then
    echo "Creating data directory..."
    mkdir -p ./data
fi

# Check if required directories exist
for dir in logs uploads backups media_cache recorddata tracedata temp search; do
    if [ ! -d "./$dir" ]; then
        echo "Creating $dir directory..."
        mkdir -p "./$dir"
    fi
done

# Set default mode if not provided
if [ -z "$MODE" ]; then
    export MODE=production
fi

# Set default address if not provided
if [ -z "$ADDR" ]; then
    export ADDR=:7072
fi

# Display configuration
echo "Configuration:"
echo "  Mode: ${MODE}"
echo "  Address: ${ADDR}"
echo "  Database Driver: ${DB_DRIVER:-sqlite}"
echo "  Database DSN: ${DSN:-./data/ling.db}"
echo "=========================================="

# Execute the main command
exec "$@"

