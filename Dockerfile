# syntax=docker/dockerfile:1.7

# -----------------------------------------------------------------------------
# Stage 1: Install dependencies
# -----------------------------------------------------------------------------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# -----------------------------------------------------------------------------
# Stage 2: Build Next.js standalone bundle
# -----------------------------------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# HANYA variabel publik (non-secret) yang dibutuhkan Next.js saat build-time.
# Variabel rahasia (PUSKRIS_TTOKEN, PUSKRIS_EOC_AUTH, PUSKRIS_NCC_*, dll.)
# TIDAK BOLEH didefinisikan di sini dan hanya disuntikkan saat runtime.
ARG NEXT_PUBLIC_BYPASS_AUTH=true
ARG NEXT_PUBLIC_BASE_PATH=
ARG NEXT_PUBLIC_DEFAULT_LOCALE=id

ENV NEXT_PUBLIC_BYPASS_AUTH=${NEXT_PUBLIC_BYPASS_AUTH}
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}
ENV NEXT_PUBLIC_DEFAULT_LOCALE=${NEXT_PUBLIC_DEFAULT_LOCALE}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Pastikan tidak ada file .env lokal yang terbawa ke proses build
RUN rm -f .env .env.* && npm run build

# -----------------------------------------------------------------------------
# Stage 3: Minimal hardened production runner
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Salin aset publik & hasil build standalone saja
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Pastikan direktori cache Next.js dapat ditulis oleh user non-root
RUN mkdir -p /app/.next/cache && chown nextjs:nodejs /app/.next/cache

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.status < 500 ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
