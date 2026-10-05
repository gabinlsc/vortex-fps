# syntax=docker/dockerfile:1
# Pin base image by digest in your deployment pipeline after CVE scanning.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json ./
# Once npm install has produced the reviewed lockfile: COPY package-lock.json ./; RUN npm ci
RUN npm install --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY shared ./shared
COPY server ./server
RUN npx esbuild server/main.ts --bundle --platform=node --format=esm --packages=external --outfile=main.mjs
RUN mkdir runtime && cd runtime && npm init -y && npm install --omit=dev --ignore-scripts --no-audit --no-fund \
    @dimforge/rapier3d-compat@0.19.3 flatbuffers@25.9.23 ws@8.18.3

FROM node:24-alpine AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/main.mjs ./main.mjs
COPY --from=build --chown=node:node /app/runtime/node_modules ./node_modules
USER node
EXPOSE 8080/tcp
STOPSIGNAL SIGTERM
CMD ["node", "main.mjs"]
