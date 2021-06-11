FROM alpine:3 AS builder

RUN apk add --no-cache nodejs pixman cairo pango libpng jpeg giflib && \
	apk add --no-cache --virtual build-dependencies yarn \
	build-base pkgconfig pixman-dev cairo-dev pango-dev libpng-dev jpeg-dev giflib-dev

RUN yarn global add node-gyp

WORKDIR /usr/src/app

COPY . .

RUN yarn install --frozen-lockfile
RUN yarn run build

FROM alpine:3

RUN apk add --no-cache nodejs ruby ruby-json ffmpeg pixman cairo pango libpng jpeg giflib

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/tools ./tools
COPY --from=builder /usr/src/app/node_modules ./node_modules

CMD ["node", "dist/main.js"]
