FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=optional
COPY . .

EXPOSE 8000

CMD ["node", "index.js"]
