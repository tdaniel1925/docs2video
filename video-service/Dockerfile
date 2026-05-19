FROM node:20-slim

# Install FFmpeg, LibreOffice, poppler-utils (for PDF conversion)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libreoffice-impress \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy server code
COPY server.js ./

EXPOSE 4000

CMD ["node", "server.js"]
