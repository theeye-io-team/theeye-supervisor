#!/usr/bin/env bash

if [ -z ${DEBUG+x} ]; then
  DEBUG='eye:*'
fi

export DEBUG

if [ -z $DOCKER ];then
	echo "Verifing/updating packages"
	npm install
fi
if [ -z $NODE_ENV ];then
	NODE_ENV='development'
fi
echo running NODE_ENV=$NODE_ENV

./node_modules/.bin/nodemon --harmony_proxies --ignore 'uploads/*' $PWD/core/main.js

exit 0;
