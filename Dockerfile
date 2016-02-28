FROM node:4.2.2
ENV destDir /src/theeye/supervisor
# Create app directory
RUN mkdir -p ${destDir}
# Install Supervisor
RUN npm install supervisor -g
#Set working Directory
WORKDIR ${destDir}
# Bundle app source
COPY . ${destDir}
# Install app dependencies
RUN cd ${destDir}; npm install
#Export and run.
EXPOSE 60080
CMD [ "npm", "run","start" ]
