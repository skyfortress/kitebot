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
FROM mcr.microsoft.com/playwright:v1.49.0-noble

RUN rm -rf /ms-playwright/webkit-*
RUN rm -rf /ms-playwright/chromium-*

WORKDIR /usr/src/web

COPY package.json ./
COPY --from=builder /usr/src/web/dist ./dist
COPY --from=dependencies /usr/src/web/node_modules ./node_modules

CMD ["npm", "run", "start:prod"]
