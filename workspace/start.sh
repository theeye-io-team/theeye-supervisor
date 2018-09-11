#!/bin/bash

NODE_ENV=localdev DEBUG=*eye* node -i -e "$(< workspace/index.js)"
