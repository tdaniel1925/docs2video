FROM node:20-slim

# Install FFmpeg, LibreOffice, poppler-utils (for PDF conversion)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libreoffice-impress \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# --- rembg logo enhancer (background removal, U2-Net) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/rembg \
    && /opt/rembg/bin/pip install --no-cache-dir "rembg[cli]==2.0.59" onnxruntime==1.19.2
ENV PATH="/opt/rembg/bin:${PATH}"
ENV U2NET_HOME="/root/.u2net"
RUN mkdir -p /root/.u2net \
    && python3 -c "from rembg import new_session; new_session('u2net')"

# --- V3 Remotion renderer: headless Chrome deps ---
RUN apt-get update && apt-get install -y --no-install-recommends \
      libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
      libpango-1.0-0 libcairo2 libatspi2.0-0 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production
# Playwright chromium for presentation->MP4 export capture
RUN npx playwright install --with-deps chromium

# --- V3 Remotion renderer: bake the remotion/ project (synced by deploy.sh) ---
COPY remotion /app/remotion
RUN cd /app/remotion \
    && npm install --no-audit --no-fund --legacy-peer-deps \
    && npx remotion browser ensure
ENV REMOTION_DIR="/app/remotion"

# Copy server code (server.js requires ./slides for the slide-deck pipeline and
# ./commercial for the commercial pipeline — ALL MUST be in the image or the
# process crashes on startup with MODULE_NOT_FOUND).
COPY server.js ./
COPY slides.js ./
COPY commercial.js ./

EXPOSE 4000

CMD ["node", "server.js"]
