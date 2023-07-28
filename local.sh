
if [ -z "${DEBUG}" ]; then
  export DEBUG="*eye*err*"
fi

if [ -z "${NODE_ENV}" ]; then
  export NODE_ENV="localdev"
fi

export MONITORING_DISABLED=""
export SCHEDULER_JOBS_DISABLED=""

node $PWD/core/swagger.js

npx nodemon ${1} $PWD/core/main.js
#node ${1} $PWD/core/main.js
