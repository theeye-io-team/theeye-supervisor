#!/usr/bin/env bash

if [ -z ${DEBUG+x} ]; then
  DEBUG='eye:*'
fi

export DEBUG

NO_MONITORING='true' NODE_ENV='localdev' ./node_modules/.bin/nodemon --harmony_proxies --ignore 'uploads/*' $PWD/core/main.js

exit 0;
