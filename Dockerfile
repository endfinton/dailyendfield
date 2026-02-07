# Use Node.js LTS Alpine for small image size
FROM node:20-alpine

# Install build dependencies for better-sqlite3
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY src/ ./src/
COPY public/ ./public/

# Create data directory for database
RUN mkdir -p /app/data

# Health check
HEALTHCHECK --interval=1h --timeout=10s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Expose web interface port
EXPOSE 3000

# Create startup script to run both server and worker
RUN echo '#!/bin/sh' > /app/start.sh && \
  echo 'node src/server.js &' >> /app/start.sh && \
  echo 'node src/worker.js &' >> /app/start.sh && \
  echo 'wait -n' >> /app/start.sh && \
  echo 'exit $?' >> /app/start.sh && \
  chmod +x /app/start.sh

# Run both processes
CMD ["/bin/sh", "/app/start.sh"]
