# 프론트를 빌드해 Caddy 이미지에 넣는다. API와 그림 주소는 같은 출처의 /api, /fa로 간다.
FROM node:24-slim AS build
COPY --from=oven/bun:1 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /src
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/public ./public
COPY frontend/src ./src
ENV REACT_APP_API_BASE_URL=/api REACT_APP_FILE_BASE_URL=/fa
RUN bun run build

FROM caddy:2
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /src/build /srv
