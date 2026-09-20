# Kavacha Credential Vault
# Deployed separately on Railway (isolated from server)
FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY src/ ./src/

RUN useradd -r -s /bin/false kavacha \
    && mkdir -p /app/audit \
    && chown -R kavacha:kavacha /app
USER kavacha

EXPOSE 4001

ENV KAVACHA_AUDIT_LOG=/app/audit/audit.log

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4001/healthz || exit 1

CMD ["node", "src/index.js"]
