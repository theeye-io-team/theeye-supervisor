#/bin/bash

echo -e "\e[92m"
DIR=$(dirname $0)
cd $DIR
echo "Executing on $DIR && $(pwd)"

echo -e "\e[39m"

if [ -z ${DEBUG+x} ]; then
  DEBUG='eye:*:error'
fi
export DEBUG
if [ -z $NODE_ENV ];then
	NODE_ENV='production'
fi
export NODE_ENV

echo running NODE_ENV=$NODE_ENV

path=`dirname $0`
execute=''
require=$(which supervisor)
if [ $? -eq 1 ]
then
    echo "Error $require is not present on this system, using nodemon instead" 
    require=$(which nodemon)
    execute="$require --harmony_proxies -i . $path/core/main.js"
else
    echo running on supervisor.
    echo "$require --harmony -i . $path/core/main.js"
    execute="$require --harmony -i . $path/core/main.js"
fi
$execute
