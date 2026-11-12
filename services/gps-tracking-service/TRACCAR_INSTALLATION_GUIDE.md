# MachineCare GPS Tracking & Telematics — Linux VPS & Hardware Installation Guide

This guide describes how to configure the **Traccar GPS Server** and **MachineCare Integration Bridge** on a Linux VPS (e.g., Ubuntu 22.04/24.04 LTS) for production deployment at `gps.machinecare.co.tz`.

---

## 1. Linux VPS Architecture & Ports

### DNS & Hostname
- Target Domain: `gps.machinecare.co.tz`
- Public IP: Assigned by VPS provider (e.g., Hetzner, DigitalOcean, or local TZ datacenter).

### Protocol Ports
| Port | Protocol | Purpose | Direction |
|------|----------|---------|-----------|
| 80, 443 | TCP | Nginx Reverse Proxy / HTTPS API & WebSocket | Inbound |
| 8082 | TCP | Traccar Web / Internal API | Localhost only (behind Nginx) |
| 5027 | TCP/UDP | Teltonika FMC920 / FMB series | Inbound from Trackers |
| 5023 | TCP/UDP | GT06 / Concox / Jimi IoT series | Inbound from Trackers |
| 5005 | TCP/UDP | Coban / TK103 trackers | Inbound from Trackers |

---

## 2. Server Firewall Configuration (UFW)

```bash
# Allow SSH, Web and GPS Tracker Ports
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 5027/tcp
sudo ufw allow 5027/udp
sudo ufw allow 5023/tcp
sudo ufw allow 5023/udp
sudo ufw enable
```

---

## 3. Traccar Server Installation

```bash
# Update OS and install Java JRE & Unzip
sudo apt update && sudo apt install -y openjdk-17-jre-headless unzip wget

# Download Traccar Linux 64-bit installer
wget https://github.com/traccar/traccar/releases/download/v6.5/traccar-linux-64-6.5.zip
unzip traccar-linux-64-6.5.zip
sudo ./traccar.run

# Start and enable Traccar service
sudo systemctl enable traccar
sudo systemctl start traccar
```

---

## 4. Traccar Configuration (`/opt/traccar/conf/traccar.xml`)

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE properties SYSTEM 'http://java.sun.com/dtd/properties.dtd'>
<properties>
    <entry key='config.default'>./conf/default.xml</entry>
    
    <!-- Database Connection: SQLite default or PostgreSQL -->
    <entry key='database.driver'>org.h2.Driver</entry>
    <entry key='database.url'>jdbc:h2:./data/database</entry>
    <entry key='database.user'>sa</entry>
    <entry key='database.password'></entry>

    <!-- Web Interface & API Port -->
    <entry key='web.port'>8082</entry>
    <entry key='web.address'>127.0.0.1</entry>

    <!-- Filter redundant zero-movement pings -->
    <entry key='filter.enable'>true</entry>
    <entry key='filter.invalid'>true</entry>
    <entry key='filter.zero'>true</entry>
    <entry key='filter.duplicate'>true</entry>
    <entry key='filter.distance'>20</entry>

    <!-- Geocoder (optional) -->
    <entry key='geocoder.enable'>false</entry>
</properties>
```

Restart Traccar after modifying:
```bash
sudo systemctl restart traccar
```

---

## 5. Nginx Reverse Proxy with HTTPS (Let's Encrypt)

Install Nginx & Certbot:
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Configure `/etc/nginx/sites-available/gps.machinecare.co.tz`:
```nginx
server {
    server_name gps.machinecare.co.tz;

    location / {
        proxy_pass http://127.0.0.1:8082;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable site and request SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/gps.machinecare.co.tz /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d gps.machinecare.co.tz
```

---

## 6. MachineCare GPS Bridge Service Deployment

```bash
# Clone or copy services/gps-tracking-service into /opt/machinecare-gps-service
sudo mkdir -p /opt/machinecare-gps-service
cd /opt/machinecare-gps-service

# Create .env
cat << 'EOF' > .env
TRACCAR_API_URL=http://127.0.0.1:8082/api
TRACCAR_WS_URL=ws://127.0.0.1:8082/api/socket
TRACCAR_ADMIN_USER=admin
TRACCAR_ADMIN_PASSWORD=YourStrongTraccarPassword
SUPABASE_URL=https://your-supabase-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJh...YourServiceRoleKey
OVERSPEED_THRESHOLD_KMH=90
BATCH_FLUSH_INTERVAL_MS=3000
