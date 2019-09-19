#Removed temporally, Facu cambio de versión de node FROM interactar/theeye-supervisor:15_09_16
FROM node:10
MAINTAINER Javier Ailbirt <jailbirt@interactar.com>
ENV destDir /src/theeye/supervisor
# Temporary Move node_modules for avoiding packages reinstallation
#Removed temporally, Facu cambio de versión de nodeRUN mv ${destDir}/node_modules /tmp/
# And remove that directory
#Removed temporally, Facu cambio de versión de nodeRUN rm -rf ${destDir}
# Create app directory
RUN mkdir -p ${destDir}
# Install Supervisor
#Replaced with docker restart always RUN npm install supervisor -g
#Set working Directory
WORKDIR ${destDir}
# Bundle app source
COPY . ${destDir}
# Move packages
#Removed temporally, Facu cambio de versión de node. RUN mv /tmp/node_modules ${destDir}
# Install app dependencies
RUN cd ${destDir}; npm install
#Export and run.
EXPOSE 60080
#By default run prod, If development is requiered This command would be override by docker-compose up
CMD ["npm","run","start"]
