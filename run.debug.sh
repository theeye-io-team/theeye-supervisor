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
	NODE_ENV='localdev'
fi
echo running NODE_ENV=$NODE_ENV

#NO_MONITORING='true' NODE_ENV='localdev' ./node_modules/.bin/nodemon --harmony_proxies --ignore 'uploads/*' $PWD/core/main.js
 ./node_modules/.bin/nodemon --harmony_proxies --ignore 'uploads/*' $PWD/core/main.js

exit 0;
