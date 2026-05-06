# ── Stage 1: Build frontend ──────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

# VITE_BASE_PATH se pasa en build-time para incrustar /fryshop en los assets
ARG VITE_BASE_PATH=/fryshop
ENV VITE_BASE_PATH=$VITE_BASE_PATH

RUN npm run build

# ── Stage 2: Build backend ───────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder
WORKDIR /build/backend

COPY backend/package*.json ./
RUN npm ci

COPY backend/ .
RUN npx prisma generate
RUN npm run build

# ── Stage 3: Production runtime ──────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Instala solo deps de producción y regenera Prisma client
COPY --from=backend-builder /build/backend/package*.json ./
COPY --from=backend-builder /build/backend/prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate

# Código compilado del backend
COPY --from=backend-builder /build/backend/dist ./dist

# Archivos estáticos del frontend (Express los sirve desde /app/public)
COPY --from=frontend-builder /build/frontend/dist ./public

# Script de entrada (migraciones + arranque)
COPY backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
