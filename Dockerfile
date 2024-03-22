FROM oven/bun:1-alpine as base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/prod
COPY package.json bun.lockb /temp/prod/
RUN cd /temp/prod && bun install --frozen-lockfile --production

FROM base AS release

RUN apk update
RUN apk add ffmpeg

COPY --from=install /temp/prod/node_modules node_modules
COPY ./src src
COPY ./package.json .

ARG PORT=3000
ENV PORT=${PORT}

USER bun

EXPOSE ${PORT}/tcp
ENTRYPOINT [ "bun", "run", "./src/index.ts" ]