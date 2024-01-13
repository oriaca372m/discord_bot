FROM alpine:3 AS builder

RUN apk add --update --no-cache nodejs-current pixman cairo pango libpng jpeg giflib \
	build-base pkgconfig pixman-dev cairo-dev pango-dev libpng-dev jpeg-dev giflib-dev libtool autoconf automake curl

RUN corepack enable pnpm

RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
RUN chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /usr/src/app

COPY package.json .
COPY pnpm-lock.yaml .
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run lint
RUN pnpm run build

RUN pnpm install --frozen-lockfile --prod

FROM alpine:3

RUN apk add --update --no-cache nodejs-current ruby ruby-json pixman cairo pango libpng jpeg giflib imagemagick python3 font-noto font-noto-cjk ffmpeg

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/tools ./tools
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp

CMD ["node", "dist/index.js"]
