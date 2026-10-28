FROM node:22-slim AS build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY . .
RUN npm ci -w services/api
RUN npm run build -w services/api
RUN npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/services/api
EXPOSE 3000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
