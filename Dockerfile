# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime stage ----
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 TZ=Asia/Manila
RUN apk add --no-cache curl
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# migrate/seed scripts: pg is traced into the standalone bundle; bcryptjs gets inlined, so copy it explicitly
COPY --from=build /app/db ./db
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
# nodemailer too, for the test email in scripts/setup-email.sh
COPY --from=build /app/node_modules/nodemailer ./node_modules/nodemailer
COPY docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x entrypoint.sh && mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD curl -fsS http://localhost:3000/api/availability >/dev/null || exit 1
ENTRYPOINT ["./entrypoint.sh"]
