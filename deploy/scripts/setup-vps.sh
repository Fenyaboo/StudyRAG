#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="${DOMAIN:-api.studyrag.bond}"
APP_DIR="${APP_DIR:-/opt/studyrag}"
REPO_DIR="${REPO_DIR:-$(pwd)}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo DOMAIN=${DOMAIN} $0" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx ufw

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

mkdir -p "${APP_DIR}/deploy" "${APP_DIR}/backend" /var/www/html
cp -R "${REPO_DIR}/deploy/docker-compose.yml" "${APP_DIR}/deploy/docker-compose.yml"
cp -R "${REPO_DIR}/backend/." "${APP_DIR}/backend/"

install -m 0644 "${REPO_DIR}/deploy/nginx/studyrag.conf" "/etc/nginx/sites-available/studyrag.conf"
ln -sf /etc/nginx/sites-available/studyrag.conf /etc/nginx/sites-enabled/studyrag.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if [[ ! -f "${APP_DIR}/backend/.env" ]]; then
  cp "${REPO_DIR}/backend/.env.example" "${APP_DIR}/backend/.env"
  echo "Created ${APP_DIR}/backend/.env — fill secrets before starting Docker."
fi

echo "VPS base setup complete. Next:"
echo "  1) Edit ${APP_DIR}/backend/.env — bắt buộc:"
echo "       DATABASE_URL       Session Pooler port 5432 (KHÔNG dùng 6543 với asyncpg)"
echo "       FRONTEND_ORIGINS   origin thật của frontend, ví dụ https://studyrag.bond"
echo "                          (để mặc định localhost sẽ bị CORS chặn mọi request từ browser)"
echo "       AI_FEATURES_ENABLED=false   giữ chế độ tạm ngưng AI"
echo "  2) Apply migrations trong Supabase SQL Editor, theo thứ tự:"
echo "       supabase/migrations/001_init.sql"
echo "       supabase/migrations/002_add_stored_document_status.sql"
echo "     Thiếu bước 002 thì upload sẽ kẹt ở trạng thái processing."
echo "  3) docker compose -f ${APP_DIR}/deploy/docker-compose.yml up -d --build"
echo "  4) curl -fsS http://127.0.0.1:8000/api/v1/ready   # mong đợi status=ready, ai_enabled=false"
echo "  5) certbot --nginx -d ${DOMAIN}"
