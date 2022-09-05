FROM node:14
MAINTAINER Javier Ailbirt <jailbirt@interactar.com>
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
