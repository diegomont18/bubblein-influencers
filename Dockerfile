# Stage 1: Dependências
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Build
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time vars for Next.js. NEXT_PUBLIC_* are inlined into the client bundle
# at build time, so the real values must be present here — not just at runtime.
# In Coolify, set these as "Build Variables" (not Environment Variables) so they
# are passed via --build-arg.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
ENV NODE_OPTIONS=--max-old-space-size=1536

RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# sharp is required by Next.js in standalone mode for image optimization
RUN cd /app && npm install --omit=dev --no-package-lock sharp && chown -R nextjs:nodejs /app/node_modules/sharp /app/node_modules/@img 2>/dev/null || true

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
