[![theeye.io](../../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/index.html)

# Argumento de tareas

## Ejecución de tareas y Workflows mediante API

Hay varios métodos para ejecutar tareas y workflows diréctamente desde la API.

Revise estas secciones de la documentación

[Usando la Secret Key de la tarea (recomendado)](/tasks/#Usando-la-Secret-Key-de-la-tarea-recomendado)

[Run Task and Workflow using Integration Token (beta)](/tasks/#Usando-claves-de-integración-general)

____

## Argumentos de Tareas.

Para ejecutar tareas con argumentos es necesario proveer valores para cada argumento y respetar la cantidad de argumentos definidos.
Si hubiera un argumento de tipo FIXED el espacio ocupado por dicho argumento debe dejarse vacío.

Se pueden usar las rutas de task o job indistintamente.

Por ejemplo para lanzar una tarea usando la ruta de job se debería usar la siguiente forma


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

Para hacer lo mismo usando la ruta de tarea se debería usar la siguiente forma


```shell

secret=$SECRET_ID
task=$TASK_ID

curl -i -sS \
  --request POST \
  --url "https://supervisor.theeye.io/task/${task}/secret/${secret}/job" \
  --header 'Content-Type: application/json' \
  --data '{"task_arguments":["arg1","arg2"]}'

```

En caso de estar utilizando access_token Bearer la ruta sería la siguiente



```shell

curl -i -sS \
  --request POST \
  --url "https://supervisor.theeye.io/task/${task}/job?access_token=${THEEYE_ACCESS_TOKEN}" \
  --header 'Content-Type: application/json' \
  --data '{"task_arguments":["arg1","arg2"]}'

```



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

#### Alternative 
