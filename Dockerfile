FROM node:14
LABEL maintainers.main="Facundo Gonzalez <facugon@theeye.io>"

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV

ARG APP_VERSION
ENV APP_VERSION $APP_VERSION

RUN echo "APP_VERSION=$APP_VERSION"; echo "NODE_ENV=$NODE_ENV";

ENV destDir /src/theeye/supervisor
# Create app directory
RUN mkdir -p ${destDir}
WORKDIR ${destDir}
COPY . ${destDir}
# Install app dependencies
RUN apt update; apt install git
RUN cd ${destDir}; npm install
#Export and run.
EXPOSE 60080
#By default run prod, If development is requiered This command would be override by docker-compose up
CMD ["npm","run","start"]
