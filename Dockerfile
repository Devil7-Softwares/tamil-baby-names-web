# syntax=docker/dockerfile:1

FROM node:24-slim AS deps

ENV HUSKY=0
WORKDIR /app

COPY .yarnrc.yml package.json yarn.lock ./
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY tools/dev-proxy/package.json tools/dev-proxy/

RUN corepack enable && yarn install --immutable

FROM deps AS build

ARG RECAPTCHA_SITE_KEY=""
ENV RECAPTCHA_SITE_KEY=$RECAPTCHA_SITE_KEY

COPY . .
RUN yarn build

FROM node:24-slim AS runtime

ENV HUSKY=0
ENV NODE_ENV=production
WORKDIR /app

COPY .yarnrc.yml package.json yarn.lock ./
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY tools/dev-proxy/package.json tools/dev-proxy/

RUN corepack enable && yarn workspaces focus @tbn/api --production

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist

COPY --from=build /app/apps/web/dist/public apps/api/dist/public
COPY --from=build /app/apps/admin/dist/public apps/api/dist/public-admin

USER node
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
