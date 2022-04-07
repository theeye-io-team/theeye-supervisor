[![theeye.io](../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Tasks Arguments

_____

## Task and Workflows. API execution

There are alternatives to directly execute tasks and workflows vía API.

Check the following Documentation Sections


[Run Task and Workflow using Integration Secret (recomended)](en/tasks/#using-task-secret-key-integration-feature-40recommended41)

[Run Task and Workflow using Integration Token (beta)](en/tasks/#api-integration-tokens)

___

## Providing Arguments

To execute a task via Api you must provide the values for every task argument.


### application/json

#### Alternative 1

```shell
secret=$SECRET_ID
task=$TASK_ID
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')

curl -i -sS \
  --request POST \
  --url "https://supervisor.theeye.io/job/secret/${secret}?customer=${customer}&task=${task}" \
  --header 'Content-Type: application/json' \
  --data '{"task_arguments":["arg1","arg2"]}'

```

#### Alternative 2

The full request body will must be an array.
Each index of the array will be mapped in the provided order with the task arguments.


```shell
secret=$SECRET_ID
task=$TASK_ID
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')

curl -i -sS \
  --request POST \
  --url "https://supervisor.theeye.io/${customer}/task/${task}/secret/${secret}/job" \
  --header 'Content-Type: application/json' \
  --data '["",{"prop":"value"},[1,2,3],0,null,"hola",""]'

```

### application/x-www-form-urlencoded

```shell
secret=$SECRET_ID
task=$TASK_ID
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')

curl -i -sS \
  --request POST \
  --url "https://supervisor.theeye.io/job/secret/${secret}?customer=${customer}&task=${task}" \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode task_arguments="arg1" \
  --data-urlencode task_arguments="arg2"
  --data-urlencode task_arguments="arg3"

```

### querystring 

#### Alternative 1

```shell

secret=$SECRET_ID
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
task=$TASK_ID

curl -i -sS \
  --request POST \
  --url "https://supervisor.theeye.io/job/secret/${secret}?customer=${customer}&task=${task}&task_arguments\[\]=arg1&task_arguments\[\]=arg2"

```

#### Alternative 2


```shell

secret=$SECRET_ID
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
task=$TASK_ID

curl -i -sS \
  --request POST \
  --url "https://supervisor.theeye.io/job/secret/${secret}" \
  --data-urlencode "task=${task}" \
  --data-urlencode "customer=${customer}" \
  --data-urlencode "task_arguments[]=${arg1}" \
  --data-urlencode "task_arguments[]=${arg2}" 

```
