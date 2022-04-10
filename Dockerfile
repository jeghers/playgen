FROM node:12.22-alpine3.15

MAINTAINER mark.jeghers@gmail.com

# Create app directory
WORKDIR /usr/local/nodeapps/playgen

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s CMD node healthcheck.js

CMD [ "node", "server.js" ]

