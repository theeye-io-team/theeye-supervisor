
export DEBUG="*eye*"
export NODE_ENV="localdev"
export MONITORING_DISABLED="true"
export SCHEDULER_JOBS_DISABLED="true"
npx nodemon ${1} $PWD/core/main.js
