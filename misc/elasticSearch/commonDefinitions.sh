#!/bin/bash
host=$1

if [ $# -ne 1 ];then echo "run $0 host" ; exit ; fi

mappings="
  \"mappings\": {
    \"_default_\": {
        \"dynamic_templates\": [

            { \"notanalyzedfields\": {
                  \"match\":              \"*\",
                  \"match_mapping_type\": \"string\",
                  \"mapping\": {
                      \"type\":        \"string\",
                      \"index\":       \"not_analyzed\"
                  }
               }
            },

            { \"locationfields\": {
                  \"match\":              \"*location*\",
                  \"mapping\": {
                      \"type\":        \"geo_point\"
                  }
               }
            }

          ]
       }
   }
"
