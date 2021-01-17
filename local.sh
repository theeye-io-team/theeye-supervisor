
export DEBUG="*eye*error*"
export NODE_ENV="localdev"
export MONITORING_DISABLED=""
export SCHEDULER_JOBS_DISABLED=""
npx nodemon ${1} $PWD/core/main.js
#node ${1} $PWD/core/main.js
