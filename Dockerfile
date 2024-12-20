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

RUN apt update && apt install --no-upgrade python3-pip -y
COPY requirements.txt vision.py ./
RUN pip3 install -r requirements.txt --no-cache-dir --break-system-packages

COPY --from=builder /usr/src/web/dist ./dist
COPY --from=dependencies /usr/src/web/node_modules ./node_modules

CMD ["node", "dist/index.js"]
