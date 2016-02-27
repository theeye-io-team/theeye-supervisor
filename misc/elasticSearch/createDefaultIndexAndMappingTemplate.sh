#!/bin/bash
source commonDefinitions.sh

curl -XPUT $host/_template/template_default -d "
{
    \"template\" : \"*\",
    \"settings\" : {
        \"number_of_shards\" : 1
    },
	$mappings
}
"
