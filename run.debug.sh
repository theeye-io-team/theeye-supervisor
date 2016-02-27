#!/usr/bin/env bash

if [ -z ${DEBUG+x} ]; then
  DEBUG='eye:*'
fi

export DEBUG

NODE_ENV='localdev' ./node_modules/.bin/nodemon --ignore 'uploads/*' $PWD/core/main.js

exit 0;
