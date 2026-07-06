# Speaker Design - Docker image
# Multi-stage build: build the static site, then serve with nginx

# --- Stage 1: Build ---
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
# Serve from the domain root in Docker (GitHub Pages uses /speaker-design/)
ENV BASE_PATH=/
RUN bun run build

# --- Stage 2: Serve ---
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
