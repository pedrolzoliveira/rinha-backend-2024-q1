FROM node:20-alpine

WORKDIR /app

COPY package.json /app
COPY server.mjs /app

RUN npm i

CMD ["node", "server.mjs"]
