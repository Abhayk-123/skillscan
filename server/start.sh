#!/usr/bin/env sh
set -e
python init_db.py
exec gunicorn app:app --bind 0.0.0.0:${PORT:-5000}
