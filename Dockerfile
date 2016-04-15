FROM node:4.3.2
MAINTAINER Javier Ailbirt <jailbirt@interactar.com>
ENV destDir /src/theeye/supervisor
# Create app directory
RUN mkdir -p ${destDir}
# Install Supervisor
RUN npm install -g supervisor
#Set working Directory
WORKDIR ${destDir}
# Bundle app source
COPY . ${destDir}
# Install app dependencies
RUN cd ${destDir}; npm install
#Export and run.
EXPOSE 60080
#By default run prod, If development is requiered This command would be override by docker-compose up
CMD [ "npm", "run","start" ]
