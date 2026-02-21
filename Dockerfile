FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules/bullmq ./node_modules/bullmq
COPY --from=deps /app/node_modules/tslib ./node_modules/tslib
COPY --from=deps /app/node_modules/@ioredis ./node_modules/@ioredis
# bullmq requires ioredis from its own node_modules
COPY --from=deps /app/node_modules/bullmq/node_modules/ioredis ./node_modules/bullmq/node_modules/ioredis
# ioredis transitive deps (required when resolving from bullmq/node_modules/ioredis)
COPY --from=deps /app/node_modules/standard-as-callback ./node_modules/standard-as-callback
COPY --from=deps /app/node_modules/cluster-key-slot ./node_modules/cluster-key-slot
COPY --from=deps /app/node_modules/denque ./node_modules/denque
COPY --from=deps /app/node_modules/redis-errors ./node_modules/redis-errors
COPY --from=deps /app/node_modules/redis-parser ./node_modules/redis-parser
COPY --from=deps /app/node_modules/debug ./node_modules/debug
COPY --from=deps /app/node_modules/ms ./node_modules/ms
COPY --from=deps /app/node_modules/lodash.defaults ./node_modules/lodash.defaults
COPY --from=deps /app/node_modules/lodash.isarguments ./node_modules/lodash.isarguments
COPY --from=deps /app/node_modules/semver ./node_modules/semver
COPY --from=deps /app/node_modules/imapflow ./node_modules/imapflow
COPY --from=deps /app/node_modules/mailparser ./node_modules/mailparser
COPY --from=deps /app/node_modules/iconv-lite ./node_modules/iconv-lite
COPY --from=deps /app/node_modules/he ./node_modules/he
COPY --from=deps /app/node_modules/libmime ./node_modules/libmime
COPY --from=deps /app/node_modules/linkify-it ./node_modules/linkify-it
COPY --from=deps /app/node_modules/punycode.js ./node_modules/punycode.js
COPY --from=deps /app/node_modules/html-to-text ./node_modules/html-to-text
COPY --from=deps /app/node_modules/nodemailer ./node_modules/nodemailer
COPY --from=deps /app/node_modules/encoding-japanese ./node_modules/encoding-japanese
COPY --from=deps /app/node_modules/@zone-eu ./node_modules/@zone-eu
COPY --from=deps /app/node_modules/tlds ./node_modules/tlds
COPY --from=builder /app/prisma/seed.mjs ./prisma/seed.mjs
COPY --from=deps /app/node_modules/bcryptjs ./node_modules/bcryptjs

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
