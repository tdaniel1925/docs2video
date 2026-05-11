#!/bin/bash
# Run this on your Hetzner VPS to set up the video assembly service

echo "=== Docs2Video Assembly Service Setup ==="

# Install dependencies
apt update && apt install -y ffmpeg nodejs npm

# Create app directory
mkdir -p /opt/docs2video-assembler
cd /opt/docs2video-assembler

# Copy files (you'll scp these)
# scp -r video-service/* root@5.161.215.156:/opt/docs2video-assembler/

# Install node dependencies
npm install

# Create environment file
cat > .env << 'EOF'
PORT=4000
API_SECRET=docs2video-assembly-secret-2026
SUPABASE_URL=https://izccljcgxsbumgsznndd.supabase.co
SUPABASE_SERVICE_KEY=YOUR_SERVICE_ROLE_KEY_HERE
EOF

# Create systemd service
cat > /etc/systemd/system/docs2video-assembler.service << 'EOF'
[Unit]
Description=Docs2Video Assembly Service
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/docs2video-assembler
EnvironmentFile=/opt/docs2video-assembler/.env
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl daemon-reload
systemctl enable docs2video-assembler
systemctl start docs2video-assembler

echo "=== Service started on port 4000 ==="
echo "Test: curl http://localhost:4000/health"
