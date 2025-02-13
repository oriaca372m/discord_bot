FROM node:slim AS builder

RUN apt-get update -y && apt-get install -y --no-install-recommends curl ca-certificates build-essential python3 \
	&& rm -rf /var/lib/apt/lists/*

RUN corepack enable pnpm

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

USER node
WORKDIR /usr/src/app

COPY --chown=node:node package.json .
COPY --chown=node:node pnpm-lock.yaml .
RUN corepack install
RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .
RUN pnpm run lint
RUN pnpm run build

RUN pnpm install --frozen-lockfile --prod

FROM node:slim

RUN apt-get update -y && apt install -y --no-install-recommends ruby ruby-json imagemagick python3 fonts-noto-cjk ffmpeg dumb-init \
	&& rm -rf /var/lib/apt/lists/*
COPY --from=builder /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp

WORKDIR /usr/src/app
USER node

COPY --chown=node:node --from=builder /usr/src/app/package.json ./
COPY --chown=node:node --from=builder /usr/src/app/tools ./tools
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist

CMD ["dumb-init", "node", "dist/index.js"]
