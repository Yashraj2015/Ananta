FROM node:22-alpine

WORKDIR /app

# Install dependencies first (cache this layer separately)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/
COPY migrations/ ./migrations/

# Create non-root user
RUN addgroup -S ananta && adduser -S ananta -G ananta
USER ananta

# Expose all service ports
EXPOSE 8080 8081 3001

ENV NODE_ENV=production

# Default port bindings
ENV PORT_API=8080
ENV PORT_FILES=8081
ENV PORT_HEALTH=3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
