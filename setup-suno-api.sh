#!/bin/bash
# ─────────────────────────────────────────────────────────
# Setup script for gcui-art/suno-api on Hetzner
# This runs the Suno API bridge that Plinkatron talks to
# ─────────────────────────────────────────────────────────

set -e

INSTALL_DIR="/var/www/suno-api"

echo "=== Setting up gcui-art/suno-api ==="

# 1. Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

if ! command -v docker compose &> /dev/null; then
    echo "ERROR: docker compose not found. Install Docker Compose v2."
    exit 1
fi

echo "Docker: $(docker --version)"

# 2. Clone the repo
if [ -d "$INSTALL_DIR" ]; then
    echo "Updating existing suno-api..."
    cd "$INSTALL_DIR"
    git pull
else
    echo "Cloning suno-api..."
    git clone https://github.com/gcui-art/suno-api.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

# 3. Create .env if it doesn't exist
if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo ""
    echo "Creating .env file..."
    echo "You need two things:"
    echo "  1. SUNO_COOKIE — from your browser (instructions below)"
    echo "  2. TWOCAPTCHA_KEY — from 2captcha.com (needed because Suno uses hCaptcha)"
    echo ""

    read -p "Enter your SUNO_COOKIE: " SUNO_COOKIE
    read -p "Enter your TWOCAPTCHA_KEY: " TWOCAPTCHA_KEY

    cat > "$INSTALL_DIR/.env" << EOF
SUNO_COOKIE=${SUNO_COOKIE}
TWOCAPTCHA_KEY=${TWOCAPTCHA_KEY}
BROWSER=chromium
BROWSER_HEADLESS=true
BROWSER_LOCALE=en
BROWSER_GHOST_CURSOR=false
EOF
    echo ".env created"
else
    echo ".env already exists"
fi

# 4. Build and start
echo ""
echo "Building and starting suno-api..."
cd "$INSTALL_DIR"
docker compose build
docker compose up -d

echo ""
echo "=== Checking if suno-api is running ==="
sleep 5
if curl -sf http://localhost:3000/api/get_limit > /dev/null 2>&1; then
    echo "suno-api is running on port 3000"
    echo ""
    echo "Credits info:"
    curl -s http://localhost:3000/api/get_limit | python3 -m json.tool 2>/dev/null || curl -s http://localhost:3000/api/get_limit
else
    echo "suno-api may still be starting. Check with:"
    echo "  docker compose logs -f"
    echo "  curl http://localhost:3000/api/get_limit"
fi

echo ""
echo "=== Next steps ==="
echo "1. Update /var/www/plinkatron/.env:"
echo "   SUNO_API_URL=http://localhost:3000"
echo "2. Restart plinkatron:"
echo "   pm2 restart plinkatron"
echo ""
echo "Done!"
