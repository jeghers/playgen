FROM node:20.15.1-alpine3.20

MAINTAINER mark.jeghers@gmail.com

# Create app directory
WORKDIR /usr/local/nodeapps/playgen

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN export $(cat .env) && npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s CMD node healthcheck.js

CMD export $(cat .env) && npm run start
