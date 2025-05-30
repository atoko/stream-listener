FROM node:24

RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./
RUN corepack install
RUN pnpm install

WORKDIR /app
COPY . .

EXPOSE 3000
ENTRYPOINT ["node"]
CMD ["module/main.mjs"] 