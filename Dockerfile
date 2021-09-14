FROM alpine:3 AS builder

RUN apk add --no-cache nodejs-current pixman cairo pango libpng jpeg giflib \
	yarn build-base pkgconfig pixman-dev cairo-dev pango-dev libpng-dev jpeg-dev giflib-dev libtool autoconf automake

RUN yarn global add node-gyp

WORKDIR /usr/src/app

COPY package.json .
COPY yarn.lock .
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn lint
RUN yarn run build

RUN yarn install --frozen-lockfile --production

FROM alpine:3

RUN apk add --no-cache nodejs-current ruby ruby-json pixman cairo pango libpng jpeg giflib imagemagick

WORKDIR /usr/src/app

ENV PATH $PATH:/usr/src/app/node_modules/ffmpeg-static

COPY --from=builder /usr/src/app/tools ./tools
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/dist ./dist

CMD ["node", "dist/main.js"]
