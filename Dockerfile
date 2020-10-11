FROM node:12.19.0-alpine3.12

RUN apk --update add python3 alpine-sdk

RUN mkdir /app

RUN mkdir /app/config

COPY package.json /app/package.json

WORKDIR /app

RUN npm install

ADD dist/lib /app/

CMD ["node", "server.js"]