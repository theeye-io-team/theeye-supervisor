#!/bin/bash

host=$1
index=$2

if [ $# -ne 2 ];then echo "run $0 index host" ; exit ; fi

mapping='{
  "mappings": {
    "_default_": {
        "dynamic_templates": [

            { "notanalyzedfields": {
                  "match":              "*",
                  "match_mapping_type": "string",
                  "mapping": {
                      "type":        "string",
                      "index":       "not_analyzed"
                  }
               }
            },

            { "locationfields": {
                  "match":              "*location*",
                  "mapping": {
                      "type":        "geo_point"
                  }
               }
            }

          ]
       }
   }
}'

echo -e "Aplicando mappings en index: $index ..."
curl -XPUT $host/$index -d "$mapping"
echo -e "\nDone!"
