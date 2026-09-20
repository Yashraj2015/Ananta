# Ananta DB — Core Server
# Production Dockerfile (Render-compatible, persistent Linux)
FROM node:22-bookworm-slim

# Install system FFmpeg for video processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy source
COPY src/ ./src/

# Create non-root user
RUN useradd -r -s /bin/false ananta && chown -R ananta:ananta /app
USER ananta

EXPOSE 3001 8080 8081 27017

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/healthz || exit 1

CMD ["node", "src/index.js"]
