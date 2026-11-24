#!/usr/bin/env bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "[LOI] Chua cai Node.js — tai ban LTS tai https://nodejs.org"
  exit 1
fi
echo "📞 AloBaMa: http://localhost:3000   (demo: demo/1234 va ongba1234/1234)"
echo "Nhấn Ctrl+C để dừng server"
node server.js
