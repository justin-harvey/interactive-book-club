# Web image (M6): build the game with Node 22, then serve the static dist/ with nginx,
# which also reverse-proxies the presence WebSocket (see docker/nginx.conf). Pairs with
# the "presence" service in docker-compose.yml.

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
# nginx:alpine's default entrypoint runs nginx in the foreground.
