#!/bin/bash
source commonDefinitions.sh

for index in $(curl --silent "$host/_cat/indices?v"|awk '{print $3}' |grep -v kibana  )
do
   curl --silent $host/$index/_mapping|grep default > /dev/null
   if [ $? -eq 1 ];then
	   echo "borrando:$host/$index"
       curl -XDELETE $host/$index
       echo -e "Aplicando mappings en index: $index ..."
       curl -XPUT $host/$index -d "$mappings"
       echo -e "\n $index Done!"
   fi
done
