#!/bin/bash
# ==============================================================================
# Tanabrew WhatsApp Service - Auto Deployment Script for Ubuntu 22.04 / 24.04 LTS
# Google Compute Engine (e2-micro Free Tier)
# ==============================================================================

set -e

echo "🚀 Starting Tanabrew WhatsApp Service Setup..."

# 1. Update packages
sudo apt-get update -y
sudo apt-get install -y curl git ufw

# 2. Install Node.js 20 LTS (if not present)
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 3. Install PM2 globally
sudo npm install -g pm2

# 4. Install dependencies and build project
echo "📦 Installing project dependencies..."
npm install
npm run build

# 5. Setup PM2 startup & run service
echo "🚀 Launching WhatsApp service via PM2..."
pm2 delete tanabrew-wa-service 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || true

# 6. Setup Firewall (UFW)
echo "🔒 Configuring firewall on port 3001..."
sudo ufw allow 3001/tcp || true
sudo ufw allow ssh || true
sudo ufw --force enable || true

echo "======================================================================"
echo "✅ Tanabrew WhatsApp Service is now RUNNING 24/7 on port 3001!"
echo "Check status anytime with: pm2 status"
echo "View live logs with:       pm2 logs tanabrew-wa-service"
echo "======================================================================"
