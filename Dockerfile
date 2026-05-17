# syntax=docker/dockerfile:1.7

# ---- Build stage ---------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first so the layer is cached when only source changes.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Bring in the rest of the source and produce the static SPA in dist/.
COPY . .
RUN yarn build

# ---- Serve stage ---------------------------------------------------------
FROM caddy:alpine AS serve

COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 80
