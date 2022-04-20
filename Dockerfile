FROM node:14
MAINTAINER Facundo Gonzalez <facugon@theeye.io>
ENV destDir /src/theeye/supervisor
# Create app directory
RUN mkdir -p ${destDir}
WORKDIR ${destDir}
COPY . ${destDir}
# Install app dependencies
RUN cd ${destDir}; npm install
#Export and run.
EXPOSE 60080
# run prod by default.
CMD ["npm","run","start"]
