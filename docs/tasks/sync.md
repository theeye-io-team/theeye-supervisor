
[![theeye.io](../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Espera de output de ejecución - Api Sync


La ejecución de tareas individuales en TheEye es asincrónica por la naturaleza de los procesos.
Esto se debe a que las tareas en general son ejecutadas en lotes mediante el uso de "Queues".
El tiempo de ejecución y la complejidad del proceso varia en cada tarea.

Habitualmente no necesitamos esperar el resultado de forma instantanea pero en algunos casos es necesario obtener el resultado de la ejecución de forma inmediata.
Este caso es lo habitual si necesitamos que el resultado de las tareas sea la respuesta de la invocación mediante API Rest.
Para lograr este comportamiento podemos utilizar la invocación vía API en modo Sync.

Cualquier tarea puede ser utilizada mediante la API Sync.
Es necesario tener en cuenta los tiempo de ejecución y los tamaños de los payloads.
Un tiempo de respuesta razonable no debe superar los 60 segundos de ejecución.

* Tiempo muy largos pueden producir Timeouts o incluso el orquestador puede cortar la comunicación de forma repentina.

* Respuestas muy grandes pueden generar errores en el procesamiento por parte de los agentes.



## Invocación Sync - Espera de resultado (wait_result)

La ejecución sync se logra utilizando el mismo endpoint utilizado para iniciar la ejecución de tareas.
Al momento de crear el job se debe incluir la directiva `wait_result=true`. Esto le indica a la API que se desea esperar el resultado.

### Parámetros adicionales

 | nombre      | desc                                                                                                | default | 
 | -----       | -----                                                                                               | -----   | 
 | wait_result | espera el resultado. redirección a /result con los parámetros del job iniciado y timeout preseteado | false   | 
 | timeout     |                                                                                                     |         | 
 | counter     |                                                                                                     |         | 
 | limit       |                                                                                                     |         | 
 | output      |   output array de la ejecución sin interpretación                                                   | default |
 | result      |   resultado completo, el output y el log de ejecución                                               |         | 
 | full        |   job completo, con todos los parámetros, similar a haber realizado un GET /job/${id}               |         | 
 | parse       |   last line output de la ejecución interpretada. Solo está soportado JSON                           |         | 

  

El cuerpo de la respuesta seguirá siendo el job nuevo creado, con su respectivo ID.

La respuesta de la API será un `status_code: 303` en lugar de `status_code: 200` que respondería normalmente.

La respuesta 303 es una redirección hacia la página donde será devuelto el resultado.

## URIs

La ejecución con espera se puede realizar utilizando `access_token`. No está soportado con `secret` y su uso está desaconsejado.

| Method | Path | Description | ACL | 
| ------ | ---- | ----------- | ----|
| POST   | /task/${id}/job | Iniciar ejecución de Tarea | user | 
| GET | /job/${id}/result | Obtener resultado de la ejecución | user | 


## Obtención del resultado Async vs Sync

Mostraremos como se realizaría una invocación sin espera y como sería lo mismo utilizando la espera con polling.

En este caso solo evaluaremos la opciones de iniciar la ejecución y luego obtener el resultados utilizando el método HTTP GET.
Exiten otras alternativas, utilizando eventos o socket, que están disponibles en diferentes variantes pero quedan fuera del alcance de este documento.

Utilizaremos el siguiente código de ejemplo

```javascript

// NodeJs boilerplate
const main = async () => {
  const response = {  }

  // add your code here.

  response.body = {
    regimen_id: "operaciones_cambio_apartado_a",
    regla_fecha_vencimiento: "byLabourDay",
    fecha: "2023-01-02T00:00:00.000Z",
    status: "por_vencer",
    periodo_origen: "01-01-2023",
    periodo_www3: "20230101",
    prorroga: false,
    createdAt: "2023-10-02T19:53:40.998Z",
    updatedAt: "2023-10-02T19:53:40.998Z",
    id: "651b1fc444587926e420dc37",
    area: "Securities",
    nro_en_www3: "14_1",
    nombre_en_w3: "OPERACIONES DE CAMBIO",
    tipo_de_regimen: "Obligatorio",
    regimen: "Operaciones de Cambio (R.I. - O.C.) - Apartado A "
  }

  response.statusCode = 201

  response.headers = {
    TheEyeJobId: JSON.parse(process.env.THEEYE_JOB).id
  }

  return { response, state: "success" }
}

// invoke main and capture result output
main()


```

En esta primer alternativa se envía el objeto response con el estado final de la ejecución.
Para el resto de los ejemplos utilizaremos este script de ejemplo.

Para otras alternativas de respuesta y opciones para encadenar tareas dirijase a ...


## Async vs Sync


<!-- tabs:start -->

#### **async**

La ejecución normal de una Tarea se realizaría de forma async de la siguiente manera

```bash
curl --request POST \
     --url "https://supervisor.theeye.io/task/64ac0b46c06feba9b89ad795/secret/${secret}/job" \
     --header 'content-type: application/json' \
     --include \ # include response headers
```

```bash
HTTP/1.1 200 OK
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Accept, Accept-Charset, Accept-Encoding, Accept-Version, Authorization, Cache-Control, Content-Length, Content-Type, Origin, User-Agent, X-Requested-With
Content-Type: application/json
Content-Length: 1368
Date: Wed, 25 Oct 2023 18:40:36 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

La respuesta es devuelta inmediatamente. El estado de la ejecución dice `"state": "in_progress"` y `"lifecycle": "ready"` que indica que el job esta esperando para ser ejecutado.

```javascript
{
  "order": 0,
  "task_arguments_values": [],
  "show_result": false,
  "assigned_users": [],
  "user_inputs": false,
  "user_inputs_members": [],
  "acl": [],
  "empty_viewers": false,
  "acl_dynamic": false,
  "cancellable": true,
  "default_state_evaluation": "success",
  "agent_logging": false,
  "_type": "ScriptJob",
  "creation_date": "2023-10-25T18:38:38.474Z",
  "last_update": "2023-10-25T18:38:38.481Z",
  "secret": "e16b0e3a9dd52b714bdcefc15b3c141d4b92c68458adabb4f43347046cc427ea",
  "output": [],
  "env": {
    "THEEYE_JOB": "{\"id\":\"653960ae5f5bf556ac433e20\",\"task_id\":\"6538069b3a10575075d0ccb5\"}",
    "THEEYE_JOB_USER": "{}",
    "THEEYE_JOB_WORKFLOW": "{}",
    "THEEYE_ORGANIZATION_NAME": "\"b78e8a19-5038-5950-a79e-4254ff74af3a\"",
    "THEEYE_API_URL": "\"http://127.0.0.1:60080\""
  },
  "task": {
    "id": "6538069b3a10575075d0ccb5",
    "_type": "ScriptTask",
    "type": "script",
    "task_arguments": [],
    "output_parameters": []
  },
  "task_id": "6538069b3a10575075d0ccb5",
  "host_id": "64aebc382f9bdaaefbe8d934",
  "host": {
    "_id": "64aebc382f9bdaaefbe8d934",
    "hostname": "draco",
    "id": "64aebc382f9bdaaefbe8d934"
  },
  "name": "ApiTest",
  "allows_dynamic_settings": false,
  "customer_id": "64aeb0020dc410fdc71c0178",
  "customer_name": "b78e8a19-5038-5950-a79e-4254ff74af3a",
  "state": "in_progress",
  "lifecycle": "ready",
  "notify": true,
  "origin": "secret",
  "triggered_by": null,
  "script_id": "6538069a3a10575075d0ccae",
  "script_runas": "node %script%",
  "timeout": 600000,
  "id": "653960ae5f5bf556ac433e20",
  "user": {}
}
```

#### **sync**

Para iniciar en modo "sync" se debe incluir el parámetro `wait_result=true`

```bash
curl --request POST \
     --url "https://supervisor.theeye.io/task/64ac0b46c06feba9b89ad795/secret/${secret}/job?wait_result=true" \
     --header 'content-type: application/json' \
     --include \ # include response headers
```

Luego de unos instantes se obtendría la siguiente respuesta

#### Headers

```shell
HTTP/1.1 201 Created
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Accept, Accept-Charset, Accept-Encoding, Accept-Version, Authorization, Cache-Control, Content-Length, Content-Type, Origin, User-Agent, X-Requested-With
TheEyeJobId: 6539264b5f5bf556ac42f5d6
Content-Type: application/json
Content-Length: 500
Date: Wed, 25 Oct 2023 14:29:40 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

#### Body

```js
{
  "regimen_id": "operaciones_cambio_apartado_a",
  "regla_fecha_vencimiento": "byLabourDay",
  "fecha": "2023-01-02T00:00:00.000Z",
  "status": "por_vencer",
  "periodo_origen": "01-01-2023",
  "periodo_www3": "20230101",
  "prorroga": false,
  "createdAt": "2023-10-02T19:53:40.998Z",
  "updatedAt": "2023-10-02T19:53:40.998Z",
  "id": "651b1fc444587926e420dc37",
  "area": "Securities",
  "nro_en_www3": "14_1",
  "nombre_en_w3": "OPERACIONES DE CAMBIO",
  "tipo_de_regimen": "Obligatorio",
  "regimen": "Operaciones de Cambio (R.I. - O.C.) - Apartado A "
}
```

<!-- tabs:end -->



### Formatos de output

*Importante*

Solo es posible modificar los parámetros del response dado por la api **sync** utilizando `parse` con un objeto `response` como resultado como se muestra en el ejemplo.

Si la tarea finaliza `success` el statusCode será 200 y en caso de `failure` será 500

<!-- tabs:start -->

#### **parse**

En caso de no indicar ningún formato `parse` es la opción por defecto


```bash
curl --url "https://supervisor.theeye.io/job/64ac6772be08c0252fb5ed1a/result?access_token=${accessToken}" \
       --header 'content-type: application/json' \
       -G --data-urlencode 'parse'
```

```js
{
  "regimen_id": "operaciones_cambio_apartado_a",
  "regla_fecha_vencimiento": "byLabourDay",
  "fecha": "2023-01-02T00:00:00.000Z",
  "status": "por_vencer",
  "periodo_origen": "01-01-2023",
  "periodo_www3": "20230101",
  "prorroga": false,
  "createdAt": "2023-10-02T19:53:40.998Z",
  "updatedAt": "2023-10-02T19:53:40.998Z",
  "id": "651b1fc444587926e420dc37",
  "area": "Securities",
  "nro_en_www3": "14_1",
  "nombre_en_w3": "OPERACIONES DE CAMBIO",
  "tipo_de_regimen": "Obligatorio",
  "regimen": "Operaciones de Cambio (R.I. - O.C.) - Apartado A "
}
```


#### **output**

El output estandar de las tareas es guardado como Array. Cada elemento del array de output se correspondera con los argumentos de entrada de la siguiente tarea encadenada.

Con el parámetro `output` obtenemos el resultadoa de la tarea de tal forma que pueda ser utilizado como input para otra tarea de un flow.

Los elementos del array pueden ser cualquier `string` o `number`

```bash
curl --url "https://supervisor.theeye.io/job/64ac6772be08c0252fb5ed1a/result?access_token=${accessToken}" \
       --header 'content-type: application/json' \
       -G --data-urlencode 'output'
```

```js
[
  "{\"state\":\"success\",\"body\":{\"regimen_id\":\"operaciones_cambio_apartado_a\",\"regla_fecha_vencimiento\":\"byLabourDay\",\"fecha\":\"2023-01-02T00:00:00.000Z\",\"status\":\"por_vencer\",\"periodo_origen\":\"01-01-2023\",\"periodo_www3\":\"20230101\",\"prorroga\":false,\"createdAt\":\"2023-10-02T19:53:40.998Z\",\"updatedAt\":\"2023-10-02T19:53:40.998Z\",\"id\":\"651b1fc444587926e420dc37\",\"area\":\"Securities\",\"nro_en_www3\":\"14_1\",\"nombre_en_w3\":\"OPERACIONES DE CAMBIO\",\"tipo_de_regimen\":\"Obligatorio\",\"regimen\":\"Operaciones de Cambio (R.I. - O.C.) - Apartado A \"},\"statusCode\":201,\"headers\":{\"TheEyeJobId\":\"6539593d5f5bf556ac433404\"}}"
]


```

#### **result**

Con el parámetro `result` se obtiene el resultado completo de la ejecución de la tarea.

```bash
curl --url "https://supervisor.theeye.io/job/64ac6772be08c0252fb5ed1a/result?access_token=${accessToken}" \
       --header 'content-type: application/json' \
       -G --data-urlencode 'result'
```

Notese que algunos elementos del output fueron removidos para hacer legible la información.

```js
{
  "code": 0,
  "log": "...",
  "lastline": "...",
  "signal": null,
  "killed": false,
  "times": {
    "seconds": 0,
    "nanoseconds": 59487955
  },
  "output": {
    "state": "success",
    "response": {
      "body": {
        ...
      },
      "statusCode": 201,
      "headers": {
        "TheEyeJobId": "65395c1b5f5bf556ac4337f3"
      }
    }
  },
  "user": {
    "email": "7791b41111c9ca7bae4536a0b9757d32e66b445b@theeye.io",
    "username": "7791b41111c9ca7bae4536a0b9757d32e66b445b",
    "id": "64aeb0020dc410fdc71c017b"
  }
}
```


#### **full**

El parámetro `full` devuelve el job completo iniciado junto con el resultado de la ejecución.

```bash
curl --url "https://supervisor.theeye.io/job/64ac6772be08c0252fb5ed1a/result?access_token=${accessToken}" \
       --header 'content-type: application/json' \
       -G --data-urlencode 'full'
```

```js
{
  "order": 0,
  "task_arguments_values": [],
  "show_result": false,
  "assigned_users": [],
  "user_inputs": false,
  "user_inputs_members": [],
  "acl": [],
  "empty_viewers": false,
  "acl_dynamic": false,
  "cancellable": true,
  "default_state_evaluation": "success",
  "script_arguments": [],
  "agent_logging": false,
  "_type": "ScriptJob",
  "creation_date": "2023-10-25T18:30:02.949Z",
  "last_update": "2023-10-25T18:30:10.383Z",
  "secret": "56f74ae7d06353c5eaebfbefd28421bddce1adbd61ecbf7c1d9c1f51d3dac2ec",
  "result": {
    "code": 0,
    "log": "...",
    "lastline": "...",
    "signal": null,
    "killed": false,
    "times": {
      "seconds": 0,
      "nanoseconds": 65750372
    },
    "output": {
      "state": "success",
      "response": {
        ...
      }
    },
    "user": {
      "email": "7791b41111c9ca7bae4536a0b9757d32e66b445b@theeye.io",
      "username": "7791b41111c9ca7bae4536a0b9757d32e66b445b",
      "id": "64aeb0020dc410fdc71c017b"
    }
  },
  "output": [
    ".."
  ],
  "env": {
    "THEEYE_JOB": "{\"id\":\"65395eaa5f5bf556ac433b7a\",\"task_id\":\"6538069b3a10575075d0ccb5\"}",
    "THEEYE_JOB_USER": "{}",
    "THEEYE_JOB_WORKFLOW": "{}",
    "THEEYE_ORGANIZATION_NAME": "\"b78e8a19-5038-5950-a79e-4254ff74af3a\"",
    "THEEYE_API_URL": "\"http://127.0.0.1:60080\""
  },
  "task": {
    ...
  },
  "task_id": "6538069b3a10575075d0ccb5",
  "host_id": "64aebc382f9bdaaefbe8d934",
  "host": "64aebc382f9bdaaefbe8d934",
  "name": "ApiTest",
  "allows_dynamic_settings": false,
  "customer": "64aeb0020dc410fdc71c0178",
  "customer_id": "64aeb0020dc410fdc71c0178",
  "customer_name": "b78e8a19-5038-5950-a79e-4254ff74af3a",
  "state": "success",
  "lifecycle": "finished",
  "notify": true,
  "origin": "secret",
  "triggered_by": null,
  "script": {
    ...
  },
  "script_id": "6538069a3a10575075d0ccae",
  "script_runas": "node %script%",
  "timeout": 600000,
  "trigger_name": "success",
  "id": "65395eaa5f5bf556ac433b7a"
}


```
<!-- tabs:end -->


## Sync - espera con polling

La espera con polling se logra mediante una redirección automática al endpoint de resultado, inmediatamente después de la creación de un job.
Si la ejecución se resuelve antes de llegar a la redirección de resultado el output de la ejecución es devuelto inmediatamente.

En un caso donde la ejecución demora unos minutos, se inicia un proceso automático de polling con tiempos de espera predefinidos.
De esta forma se inicia un loop de redirecciones con polling automático.


### Inciar una solicitud con polling

La diferencia entre la ejecución con `wait_result=true` se puede ver en los headers de respuesta de la invocación.

Las dos formas de especificar la espera son o por querystring o por json body. 
El formato utilizado en este caso va a depender de la forma en que serán provistos los argumentos de tarea

<!-- tabs:start -->

#### **json body**

```bash
 curl --location \
   --include \
   --request POST \
   --url "https://supervisor.theeye.io/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}" \
   --header 'content-type: application/json' \
   -d '{"wait_result":true}'
```

#### **querystring**

```bash
 curl 
   --location \
   --include \
   --request POST \
   --url "https://supervisor.theeye.io/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}&wait_result=true" 
```
<!-- tabs:end -->

En ambos casos la respuesta tendrá el mismo body que la ejecución async, pero los "headers" serán distintos.

### Headers

```
HTTP/1.1 303 See Other
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Accept, Accept-Charset, Accept-Encoding, Accept-Version, Authorization, Cache-Control, Content-Length, Content-Type, Origin, User-Agent, X-Requested-With
Location: /job/64ac781514d56746186733ff/result?access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImZpbGVzLThkOWVlMTI3OGI1MjVmMTdlZTExOWZmNjMxOWVlNGJhY2FkMzkwZTItaW50ZWdyYXRpb25AdGhlZXllLmlvIiwidXNlcm5hbWUiOiJmaWxlcy04ZDllZTEyNzhiNTI1ZjE3ZWUxMTlmZjYzMTllZTRiYWNhZDM5MGUyLWludGVncmF0aW9uIiwidXNlcl9pZCI6IjY0YWM2MjJlY2ZkM2Y2YjhjMDRmZjc5YyIsIm9yZ191dWlkIjoiZmlsZXMiLCJpbnRlZ3JhdGlvbnMiOlt7Im5hbWUiOiJlbGFzdGljc2VhcmNoIiwiZW5hYmxlZCI6ZmFsc2V9LHsibmFtZSI6ImVudGVycHJpc2VfbG9naW4iLCJlbmFibGVkIjp0cnVlfSx7Im5hbWUiOiJmaWxlcyIsImVuYWJsZWQiOnRydWV9LHsibmFtZSI6InJlbW90ZV9sb2dnZXIiLCJlbmFibGVkIjpmYWxzZX0seyJuYW1lIjoiZGlnaXRpemUiLCJlbmFibGVkIjp0cnVlfSx7Im5hbWUiOiJnaXRodWIifV0sImlhdCI6MTY4OTAxODkyNn0.EbnnQoj2C0BchbbX_SVZzXDNvXN1vvxeQy2G1NFGe6qJpYH6BvD_O8Mcq4ZGKUz-G65j8Gqqw8IiNzZu_sYO4A&counter=0&limit=10&timeout=5
Content-Type: application/json
Content-Length: 1653
Date: Mon, 10 Jul 2023 21:28:53 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

Las dos diferencias mas importantes en los headers son

#### HTTP status 303

Esto indica que la solicitud está siendo redireccionada a otra URL.

Con el comando "curl" se deben utilizar los parámetros --location y --max-redirs para el parseo automático de los encabezados.


#### Header Location

La redirección va acompañada del "Header Location" que indica a donde debe ser redirigido para continuar con el polling.

El header Location contiene la URL donde se puede obtener la respuesta como vimos anteriormente. Además se sumaron algunos parámetros de control adicionales que analizaremos a continuación.

### Configuración del polling automático

El polling automático se inicia con una solicitud a la URL de obtención de resultado `/job/${id}/result`

| Parámetro | Descripción |
| ----- | ----- |
| `/job/${id}/result` | URL Bearer con jobId |
| `counter=0` | cantidad de veces que se ejecutó el GET de resultado. |
| `limit=10` | cantidad máxima de GET que se van a ejecutar. Cuando `counter === limit` se detendrá el polling. |
| `timeout=5` | tiempo máximo (request timeout) que el servidor mantendrá viva la conexión, esperando el resultado del job, antes de continuar con los chequeos y avanzar al siguiente loop o dar por terminado el polling. |

Utilizando todos estos parámetros en combinación se puede configurar el tiempo máximo de espera del resultado.

## Primer ejemplo de invocación

6 iteraciones (limit=6) de 10 segundos cada una (timeout=10) nos dará como resultado una espera de 1 minuto.

Para esperar el resultado de la ejecución de una tarea por un máximo de 50 segundos y obtener el output como un objeto en formato JSON, debemos iniciar el nuevo job con los siguientes parámetros


* limit=6

* timeout=10

* parse

* wait_result=true


```bash
curl --request POST \
     --include \
     --location \
     --url "https://supervisor.theeye.io/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}&limit=6&timeout=10&wait_result=true&parse" \
     --header 'content-type: application/json' \
     --data '["arg1","arg2","arg3"]'
```

El resultado será el siguiente

```bash


HTTP/1.1 303 See Other
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Accept, Accept-Charset, Accept-Encoding, Accept-Version, Authorization, Cache-Control, Content-Length, Content-Type, Origin, User-Agent, X-Requested-With
Location: /job/64ac855014d56746186752a1/result?access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImZpbGVzLThkOWVlMTI3OGI1MjVmMTdlZTExOWZmNjMxOWVlNGJhY2FkMzkwZTItaW50ZWdyYXRpb25AdGhlZXllLmlvIiwidXNlcm5hbWUiOiJmaWxlcy04ZDllZTEyNzhiNTI1ZjE3ZWUxMTlmZjYzMTllZTRiYWNhZDM5MGUyLWludGVncmF0aW9uIiwidXNlcl9pZCI6IjY0YWM2MjJlY2ZkM2Y2YjhjMDRmZjc5YyIsIm9yZ191dWlkIjoiZmlsZXMiLCJpbnRlZ3JhdGlvbnMiOlt7Im5hbWUiOiJlbGFzdGljc2VhcmNoIiwiZW5hYmxlZCI6ZmFsc2V9LHsibmFtZSI6ImVudGVycHJpc2VfbG9naW4iLCJlbmFibGVkIjp0cnVlfSx7Im5hbWUiOiJmaWxlcyIsImVuYWJsZWQiOnRydWV9LHsibmFtZSI6InJlbW90ZV9sb2dnZXIiLCJlbmFibGVkIjpmYWxzZX0seyJuYW1lIjoiZGlnaXRpemUiLCJlbmFibGVkIjp0cnVlfSx7Im5hbWUiOiJnaXRodWIifV0sImlhdCI6MTY4OTAxODkyNn0.EbnnQoj2C0BchbbX_SVZzXDNvXN1vvxeQy2G1NFGe6qJpYH6BvD_O8Mcq4ZGKUz-G65j8Gqqw8IiNzZu_sYO4A&limit=6&timeout=10&wait_result=true&parse=&counter=0
Content-Type: application/json
Content-Length: 1653
Date: Mon, 10 Jul 2023 22:25:20 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 303 See Other
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Accept, Accept-Charset, Accept-Encoding, Accept-Version, Authorization, Cache-Control, Content-Length, Content-Type, Origin, User-Agent, X-Requested-With
Location: /job/64ac855014d56746186752a1/result?access_token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImZpbGVzLThkOWVlMTI3OGI1MjVmMTdlZTExOWZmNjMxOWVlNGJhY2FkMzkwZTItaW50ZWdyYXRpb25AdGhlZXllLmlvIiwidXNlcm5hbWUiOiJmaWxlcy04ZDllZTEyNzhiNTI1ZjE3ZWUxMTlmZjYzMTllZTRiYWNhZDM5MGUyLWludGVncmF0aW9uIiwidXNlcl9pZCI6IjY0YWM2MjJlY2ZkM2Y2YjhjMDRmZjc5YyIsIm9yZ191dWlkIjoiZmlsZXMiLCJpbnRlZ3JhdGlvbnMiOlt7Im5hbWUiOiJlbGFzdGljc2VhcmNoIiwiZW5hYmxlZCI6ZmFsc2V9LHsibmFtZSI6ImVudGVycHJpc2VfbG9naW4iLCJlbmFibGVkIjp0cnVlfSx7Im5hbWUiOiJmaWxlcyIsImVuYWJsZWQiOnRydWV9LHsibmFtZSI6InJlbW90ZV9sb2dnZXIiLCJlbmFibGVkIjpmYWxzZX0seyJuYW1lIjoiZGlnaXRpemUiLCJlbmFibGVkIjp0cnVlfSx7Im5hbWUiOiJnaXRodWIifV0sImlhdCI6MTY4OTAxODkyNn0.EbnnQoj2C0BchbbX_SVZzXDNvXN1vvxeQy2G1NFGe6qJpYH6BvD_O8Mcq4ZGKUz-G65j8Gqqw8IiNzZu_sYO4A&limit=6&timeout=10&wait_result=true&parse=&counter=1
Content-Type: application/json
Content-Length: 2
Date: Mon, 10 Jul 2023 22:25:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

HTTP/1.1 200 OK
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Accept, Accept-Charset, Accept-Encoding, Accept-Version, Authorization, Cache-Control, Content-Length, Content-Type, Origin, User-Agent, X-Requested-With
Content-Type: application/json
Content-Length: 26
Date: Mon, 10 Jul 2023 22:25:30 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"message":"Hello world!"}

```

## Respuesta Rest


Por defecto la API Sync responde con el output obtenido de la ejecución de la tarea.
El output es, lo que desde la interfaz, se visualiza en la sección "output" del resultado de la ejecución.

Un job representa una instancia de ejecución de una tarea.  El output está asociado al "job" y será accesible mientras el job exista en la base de datos.


| State | HTTP Status Code | 
| ---- |  ---- |
| success | 200 | 
| failure | 500 | 


### Nota

* Por el momento solo es posible la ejecución de _Tareas Individuales_ .



## Más ejemplos

Para los siguientes ejemplos usamos esta receta.

Puede descargar e importar [esta receta utilizada para todos los ejemplos](/tasks/Rest_API_Response.json ":ignore")


### Resultado "failure"


```bash

curl -i -X POST \
     --url "https://supervisor.theeye.io/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}&limit=6&timeout=10&wait_result=true" \
       --header 'content-type: application/json' \
       --data '{"task_arguments":[200]}'

```


```http

HTTP/1.1 500 Internal Server Error
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Origin, Accept, User-Agent, Accept-Charset, Cache-Control, Accept-Encoding, Content-Type, Authorization, Content-Length, X-Requested-With
Content-Type: application/json; charset=utf-8
Content-Length: 135
Date: Fri, 28 Jan 2022 16:59:54 GMT
Connection: keep-alive
Keep-Alive: timeout=5

["{\"message\":\"Validation Error. Invalid Argument Value\",\"statusCode\":418,\"name\":\"ClientError\",\"code\":\"\",\"status\":418}"]


```

### Resultado "success"


```bash
curl -i -X POST \
     --url "https://supervisor.theeye.io/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}&limit=6&timeout=10&wait_result=true" \
       --header 'content-type: application/json' \
       --data '{"task_arguments":[100]}'

```

```http

HTTP/1.1 200 OK
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Origin, Accept, User-Agent, Accept-Charset, Cache-Control, Accept-Encoding, Content-Type, Authorization, Content-Length, X-Requested-With
Content-Type: application/json; charset=utf-8
Content-Length: 62
Date: Fri, 28 Jan 2022 17:00:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

["{\"name\":\"tomer\",\"date\":\"2022-01-28T17:00:22.676Z\"}"]

```


### "success" usando "parse"


```bash

curl -i -X POST \
     --url "https://supervisor.theeye.io/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}&limit=6&timeout=10&wait_result=true&parse" \
       --header 'content-type: application/json' \
       --data '{"task_arguments":[100]}'

```


```http

HTTP/1.1 200 OK
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Origin, Accept, User-Agent, Accept-Charset, Cache-Control, Accept-Encoding, Content-Type, Authorization, Content-Length, X-Requested-With
Content-Type: application/json; charset=utf-8
Content-Length: 50
Date: Fri, 28 Jan 2022 16:26:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"name":"tomer","date":"2022-01-28T16:26:41.201Z"}

```

### "failure" usando "parse"


```bash

curl -i -X POST \
     --url "https://supervisor.theeye.io/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}&limit=6&timeout=10&wait_result=true&parse" \
       --header 'content-type: application/json' \
       --data '{"task_arguments":[200]}'

```


```http

HTTP/1.1 418 I'm a Teapot
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Origin, Accept, User-Agent, Accept-Charset, Cache-Control, Accept-Encoding, Content-Type, Authorization, Content-Length, X-Requested-With
Content-Type: application/json; charset=utf-8
Content-Length: 115
Date: Fri, 28 Jan 2022 16:56:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"message":"Validation Error. Invalid Argument Value","statusCode":418,"name":"ClientError","code":"","status":418}

```

