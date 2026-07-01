FROM node:22-bookworm-slim AS verify

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY scripts ./scripts
COPY src ./src
COPY test ./test

RUN npm run verify:bot

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

USER node

CMD ["node", "src/bot/index.js"]
