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
FROM python:3.12-bookworm

RUN apt update && apt install -y nodejs npm ffmpeg
RUN npm install -g playwright@1.49.0
RUN playwright install firefox --with-deps

WORKDIR /usr/src/web
COPY requirements.txt ./
RUN pip3 install -r requirements.txt --no-cache-dir --break-system-packages
COPY vision.py detr-resnet-101 ./
COPY --from=builder /usr/src/web/dist ./dist
COPY --from=dependencies /usr/src/web/node_modules ./node_modules

CMD ["node", "dist/index.js"]
