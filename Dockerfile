FROM node:23.11.1-alpine3.20

LABEL org.opencontainers.image.authors="mark.jeghers@gmail.com"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.description="Playgen playlist generator"

# Create app directory
WORKDIR /usr/src/nodeapps/playgen

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

COPY ./.env .
RUN export $(cat .env) && npm install
# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=30s --start-period=5s CMD node healthcheck.js

CMD [ "sh", "entrypoint.sh" ]
