#!/usr/bin/env bash
set -Eeuo pipefail

API_DOMAIN="${API_DOMAIN:-api.examoras.site}"
APP_DIR="${APP_DIR:-/opt/examoras}"
REPO_DIR="${REPO_DIR:-$(pwd)}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Vui lòng chạy dưới quyền root: sudo API_DOMAIN=${API_DOMAIN} $0" >&2
  exit 1
fi

echo "============================================================"
echo "🚀 BẮT ĐẦU CÀI ĐẶT VPS TỐI ƯU CHO EXAMORAS BACKEND (1 CPU / 1GB RAM)"
echo "============================================================"
echo "• API Domain       : ${API_DOMAIN}"
echo "• Thư mục cài đặt  : ${APP_DIR}"
echo "------------------------------------------------------------"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl git nginx certbot python3-certbot-nginx ufw

# 1. Cài đặt Docker & Docker Compose nếu chưa có
if ! command -v docker >/dev/null 2>&1; then
  echo "📦 Đang cài đặt Docker Engine..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# 2. Tạo cấu trúc thư mục
mkdir -p "${APP_DIR}/deploy/nginx" "${APP_DIR}/backend" /var/www/html
cp -R "${REPO_DIR}/deploy/docker-compose.yml" "${APP_DIR}/deploy/docker-compose.yml"
cp -R "${REPO_DIR}/backend/." "${APP_DIR}/backend/"

# 3. Cấu hình Nginx Reverse Proxy
install -m 0644 "${REPO_DIR}/deploy/nginx/examoras.conf" "/etc/nginx/sites-available/examoras.conf"
ln -sf /etc/nginx/sites-available/examoras.conf /etc/nginx/sites-enabled/examoras.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# 4. Cấu hình tường lửa UFW
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 5. Khởi tạo file .env nếu chưa có
if [[ ! -f "${APP_DIR}/backend/.env" ]]; then
  cp "${REPO_DIR}/backend/.env.example" "${APP_DIR}/backend/.env"
  echo "⚠️ Đã tạo file ${APP_DIR}/backend/.env — Vui lòng điền thông số trước khi start Docker."
fi

echo ""
echo "============================================================"
echo "✅ HOÀN TẤT CÀI ĐẶT MÔI TRƯỜNG VPS!"
echo "============================================================"
echo "Các bước tiếp theo của bạn:"
echo "  1) Chỉnh sửa file bí mật: nano ${APP_DIR}/backend/.env"
echo "  2) Khởi động container API duy nhất:"
echo "     cd ${APP_DIR}/deploy && docker compose up -d --build"
echo "  3) Cấp chứng chỉ SSL HTTPS:"
echo "     certbot --nginx -d ${API_DOMAIN}"
echo "  4) Kiểm tra sẵn sàng: https://${API_DOMAIN}/api/v1/ready"
echo "============================================================"
