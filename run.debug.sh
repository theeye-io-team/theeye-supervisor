#!/usr/bin/env bash

if [ -z ${DEBUG+x} ]; then
  DEBUG='eye:*'
fi

export DEBUG

if [ -z $DOCKER ];then
	echo "Verifing/updating packages"
	npm install
fi

#NO_MONITORING='true' NODE_ENV='localdev' ./node_modules/.bin/nodemon --harmony_proxies --ignore 'uploads/*' $PWD/core/main.js
NODE_ENV='localdev' ./node_modules/.bin/nodemon --harmony_proxies --ignore 'uploads/*' $PWD/core/main.js

exit 0;
