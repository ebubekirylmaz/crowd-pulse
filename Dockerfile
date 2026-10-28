FROM node:20-slim AS build
WORKDIR /app
COPY . .
RUN npm ci -w services/api
RUN npm run build -w services/api

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY . .
RUN npm ci -w services/api --omit=dev
COPY --from=build /app/services/api/dist ./services/api/dist
WORKDIR /app/services/api
EXPOSE 3000
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
