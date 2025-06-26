FROM node:24

RUN mkdir -p /app
WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

RUN npm run build

ENV OIDC_AUTHORIZE_LINK=true
CMD ["node", "module/main.mjs", "--envfile=iac/.env"]
