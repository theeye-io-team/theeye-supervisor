[![theeye.io](../../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/index.html)

# Argumento de tareas

## Ejecución de tareas y Workflows mediante API

Hay varios métodos para ejecutar tareas y workflows diréctamente desde la API.

Revise estas secciones de la documentación

[Clave Secret de la tarea](/tasks/#Usando-la-Secret-Key-de-la-tarea-recomendado)

[Integration Token](/tasks/#Usando-claves-de-integración-general)


## Invocación con Argumentos

A continuación exploraremos las distintas formas de proveer los argumentos para iniciar la ejecución de las tareas y workflows.

A traves de la API los argumentos pueden ser proporcionados de diferentes maneras.

### Uso de "task_arguments"

Los argumentos pueden ser enviados usando la propiedad "task_arguments".
Esta es un array ordenado, donde cada posicion del array corresponde a un argumento de la tarea.

En caso de tener argumentos marcados como opcionales (required: false) o fijos (type: fixed) se deben proveer vacíos o NULL para poder mantener el orden y el posicionamiento.

Esta opción debe ser utilizada cuando es necesario proveer los argumentos de la tarea en conjunto con parámetros de configuración de inicialización adicionales.

<!-- tabs:start -->

##### ** application/json **

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

##### ** querystring **

```shell
secret=$SECRET_ID
task=$TASK_ID
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')

curl -i -sS \
  --request POST \
  --url "https://supervisor.theeye.io/job/secret/${secret}?customer=${customer}&task=${task}&task_arguments\[\]=arg1&task_arguments\[\]=arg2"
```

El ejemplo anterior puede ser escrito de la siguiente manera

```shell
secret=$SECRET_ID
task=$TASK_ID
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')

curl -i -sS \
  --request POST \
  --url "https://supervisor.theeye.io/job/secret/${secret}" \
  --data-urlencode customer="${customer}" \
  --data-urlencode task="${task}" \
  --data-urlencode task_arguments="arg1" \
  --data-urlencode task_arguments="arg2" \
  --data-urlencode task_arguments="arg3"

```

##### ** application/x-www-form-urlencoded **

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

<!-- tabs:end -->

### Request Body

En este ejemplo el cuerpo completo de la solicitud será tomada como lista de argumentos para iniciar la tarea.

<!-- tabs:start -->

##### ** application/json **

Utilizaremos el header HTTP `Content-Type: application/json`.

Siempre que el cuerpo de la solicitud sea un Array será interpretado como lista de argumentos para la tarea.

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

En caso de que la tarea reciba un solo argumento puede ser enviado un payload completo sin formato Array.

La API se encargara de convertirlo a Array al iniciar la ejecución.

```shell
secret=$SECRET_ID
task=$TASK_ID
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')

curl -i -sS \
  --request POST \
  --url "https://supervisor.theeye.io/${customer}/task/${task}/secret/${secret}/job" \
  --header 'Content-Type: application/json' \
  --data '{ "prop": "value", "more values": [ [1,2,3], 0, null, "hola", "" ] }'

```

<!-- tabs:end -->

