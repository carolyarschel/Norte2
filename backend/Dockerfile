FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/database/migrations ./dist/database/migrations
COPY package*.json ./
RUN npm ci --omit=dev

RUN printf '#!/bin/sh\nset -e\necho "Running database migrations..."\nnode dist/database/migrate.js\necho "Starting server..."\nexec node dist/server.js\n' > entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 3001
ENTRYPOINT ["./entrypoint.sh"]
