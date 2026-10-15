FROM node:22-bookworm-slim AS frontend
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci --ignore-scripts
COPY client/ ./
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY server/ ./
COPY --from=frontend /app/client/dist /app/client/dist
USER node
EXPOSE 8080
CMD ["node", "index.js"]
