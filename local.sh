
if [ -z "${DEBUG}" ]; then
  export DEBUG="*eye*err*"
fi

if [ -z "${NODE_ENV}" ]; then
  export NODE_ENV="localdev"
fi

if [ -z "${MONITORING_DISABLED}" ]; then
  export MONITORING_DISABLED=""
fi

if [ -z "${SCHEDULER_JOBS_DISABLED}" ]; then
  export SCHEDULER_JOBS_DISABLED=""
fi

#npx nodemon $PWD/core/main.js
npx nodemon ${1} $PWD/core/main.js


