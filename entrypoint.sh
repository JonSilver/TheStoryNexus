#!/bin/sh
set -eu

DATA_DIR="/app/data"
DB_PATH="${DATABASE_PATH:-/app/data/storynexus.db}"

# Normalise path
if REAL_DB_PATH=$(readlink -f -- "$DB_PATH" 2>/dev/null); then
  DB_PATH="$REAL_DB_PATH"
fi

DB_DIR=$(dirname -- "$DB_PATH")

echo "Startup: DATA_DIR=$DATA_DIR"
echo "Startup: DATABASE_PATH=$DB_PATH"

# 1) /app/data must be a mount
if command -v mountpoint >/dev/null 2>&1; then
  mountpoint -q "$DATA_DIR" || {
    echo "Fatal: $DATA_DIR is not a mounted volume." >&2
    exit 1
  }
else
  awk '{print $5}' /proc/self/mountinfo | grep -xq "$DATA_DIR" || {
    echo "Fatal: $DATA_DIR is not a mounted volume." >&2
    exit 1
  }
fi

# 2) DB must live under /app/data
case "$DB_PATH" in
  /app/data/*) ;;
  *)
    echo "Fatal: DATABASE_PATH ($DB_PATH) is not under $DATA_DIR." >&2
    exit 1
    ;;
esac

# 3) DB directory must be mount-backed
if command -v mountpoint >/dev/null 2>&1; then
  mountpoint -q "$DB_DIR" || {
    echo "Fatal: DB directory ($DB_DIR) is not mount-backed." >&2
    exit 1
  }
else
  awk '{print $5}' /proc/self/mountinfo | grep -xq "$DB_DIR" || {
    echo "Fatal: DB directory ($DB_DIR) is not mount-backed." >&2
    exit 1
  }
fi

# 4) Check write access
if ! touch "$DATA_DIR/.write-test" 2>/dev/null; then
  echo "Fatal: No write access to $DATA_DIR." >&2
  echo "Fix: On the host, run: sudo chown -R 1000:1000 <your-data-path>" >&2
  exit 1
fi
rm -f "$DATA_DIR/.write-test"

mkdir -p "$DB_DIR"
exec "$@"
