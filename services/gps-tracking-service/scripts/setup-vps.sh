#!/bin/bash
# ==============================================================================
# MachineCare GPS Server (Traccar) & Telematics Bridge VPS Setup Script
# Target OS: Ubuntu 22.04 / 24.04 LTS
# Target Domain: gps.machinecare.co.tz
# ==============================================================================

set -e

DOMAIN="gps.machinecare.co.tz"
ADMIN_EMAIL="admin@machinecare.co.tz"
APP_DIR="/opt/machinecare-gps"

echo "=========================================================="
echo " Starting MachineCare GPS Server Provisioning on $(hostname)"
echo " Domain: $DOMAIN"
echo "=========================================================="

# 1. Update OS & Install Core Dependencies
echo "[1/6] Updating APT repositories & installing tools..."
export DEBIAN_FRONTEND=noninteractive
apt update && apt upgrade -y
apt install -y curl wget git unzip ufw fail2ban nginx certbot python3-certbot-nginx \
  ca-certificates gnupg lsb-release openjdk-17-jre-headless htop jq

# 2. Configure UFW Firewall
echo "[2/6] Configuring UFW Firewall for Telematics Ports..."
ufw default deny incoming
ufw default allow outgoing

# Management & Web Ports
ufw allow 22/tcp comment 'SSH Remote Access'
ufw allow 80/tcp comment 'HTTP Let’s Encrypt Challenge'
ufw allow 443/tcp comment 'HTTPS Secure Reverse Proxy'

# Hardware Tracker Listener Ports
ufw allow 5027/tcp comment 'Teltonika FMC920 TCP'
ufw allow 5027/udp comment 'Teltonika FMC920 UDP'
ufw allow 5023/tcp comment 'GT06 / Concox / Jimi IoT TCP'
ufw allow 5023/udp comment 'GT06 / Concox / Jimi IoT UDP'
ufw allow 5005/tcp comment 'Coban TK103 TCP'
ufw allow 5011/tcp comment 'Suntech TCP'
ufw allow 5004/tcp comment 'Queclink TCP'

echo "y" | ufw enable
ufw status verbose

# 3. Configure Fail2Ban for Brute-Force Protection
echo "[3/6] Hardening server with Fail2Ban..."
cat << 'F2B' > /etc/fail2ban/jail.local
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
F2B
systemctl restart fail2ban
systemctl enable fail2ban

# 4. Install Traccar 6.x Standalone
echo "[4/6] Installing Traccar GPS Middleware..."
TRACCAR_VER="6.5"
mkdir -p /tmp/traccar-install
cd /tmp/traccar-install
if [ ! -f "traccar.run" ]; then
  wget -q "https://github.com/traccar/traccar/releases/download/v${TRACCAR_VER}/traccar-linux-64-${TRACCAR_VER}.zip"
  unzip -q "traccar-linux-64-${TRACCAR_VER}.zip"
  ./traccar.run
fi

# Copy customized traccar.xml
mkdir -p /opt/traccar/conf /opt/traccar/data /opt/traccar/logs
if [ -f "$APP_DIR/traccar/traccar.xml" ]; then
  cp "$APP_DIR/traccar/traccar.xml" /opt/traccar/conf/traccar.xml
fi

systemctl daemon-reload
systemctl enable traccar
systemctl restart traccar
echo "Traccar service active on port 8082."

# 5. Configure Nginx Reverse Proxy & WebSocket Headers
echo "[5/6] Setting up Nginx Reverse Proxy for $DOMAIN..."
cat << NGINX_CONF > /etc/nginx/sites-available/$DOMAIN
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # WebSocket timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
NGINX_CONF

ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 6. Obtain Let's Encrypt SSL/TLS Certificate
echo "[6/6] Requesting SSL/TLS Certificate for $DOMAIN..."
if [ "$1" == "--cert" ]; then
  certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $ADMIN_EMAIL --redirect
  echo "SSL configured successfully!"
else
  echo "Run 'sudo certbot --nginx -d $DOMAIN' once DNS points to this server IP."
fi

echo "=========================================================="
echo " MachineCare GPS Server Provisioning Complete!"
echo " Web UI / API: https://$DOMAIN"
echo " Teltonika Port: 5027"
echo " Concox Port:    5023"
echo "=========================================================="
