# Build Stage
FROM node:22 AS builder

WORKDIR /usr/src/web

COPY package.json yarn.lock ./
RUN yarn install --production=false

COPY . .
RUN yarn run build

# Install Production Dependencies
FROM node:22 AS dependencies

WORKDIR /usr/src/web

COPY package.json yarn.lock ./
RUN yarn install --production

# Runtime Stage
FROM mcr.microsoft.com/playwright:latest

WORKDIR /usr/src/web

COPY --from=builder /usr/src/web/dist ./dist
COPY --from=dependencies /usr/src/web/node_modules ./node_modules

CMD ["node", "dist/index.js"]
