# syntax=docker/dockerfile:1

# ---------- Estágio 1: dependências + Prisma Client ----------
FROM node:20-alpine AS base
# openssl é exigido pelo engine do Prisma no Alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY tests ./tests
COPY jest.config.js ./

# ---------- Estágio de testes (docker build --target test) ----------
FROM base AS test
ENV NODE_ENV=test
CMD ["sh", "-c", "npx prisma migrate deploy && npm test"]

# ---------- Estágio final: produção (imagem enxuta, sem devDependencies) ----------
FROM base AS production
ENV NODE_ENV=production
RUN npm prune --omit=dev && rm -rf tests jest.config.js
# Segurança: não executar como root
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
# Aplica migrations, popula o cardápio (se vazio) e inicia a API
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/server.js"]
