FROM node:4.2.2
ENV destDir /home/webon/theeye/supervisor
# Create app directory
RUN mkdir -p ${destDir}
WORKDIR ${destDir}
# Install app dependencies
COPY supervisor/package.json ${destDir}
RUN npm install
# Bundle app source
COPY . ${destDir}
EXPOSE 60080
CMD [ "npm", "run","start" ]
