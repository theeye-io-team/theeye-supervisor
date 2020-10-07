
export DEBUG="*eye*"
export NODE_ENV="localdev"
export MONITORING_DISABLED="false"
export SCHEDULER_JOBS_DISABLED="false"
npx nodemon ${1} $PWD/core/main.js
