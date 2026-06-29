FROM node:22-slim

WORKDIR /app

# curl is needed for the Coolify container healthcheck (HTTP probe to /health);
# node:22-slim ships without it.
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=optional
COPY . .

EXPOSE 8000

CMD ["node", "index.js"]
