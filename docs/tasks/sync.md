[![theeye.io](../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Ejecución sincrónica de tareas.


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

* Respuesta muy grandes puede generar error en el procesamiento por parte de los agentes.



## Invocación Sync - Espera de resultado (wait_result)

La ejecución sync se logra utilizando el mimo endpoint utilizado para iniciar la ejecución de tareas.
Al momento de crear el job se debe incluir la directiva `wait_result=true`. Esto le indica a la API que se desea esperar el resultado.

### Parametros adicionales

 | nombre      | desc                                                                                              | default | 
 | -----       | -----                                                                                             | -----   | 
 | wait_result | espera el resulto. redireccion a /result con los parametros del job iniciado y timeout preseteado | false   | 
 | timeout     |                                                                                                   |         | 
 | counter     |                                                                                                   |         | 
 | limit       |                                                                                                   |         | 
 | output      |  output array de la ejecución sin interpretación | default |
 | result      |   resultado completo, el output y el log de ejecución                |         | 
 | full        |   job completo, con todos los parametros , similar a haber realizado un GET /job/${id}  |        | 
 | parse       |   last line output de la ejecución interpretado. solo JSON esta soportado                |         | 

  

El cuerpo de la respuesta seguirá siendo el job nuevo creado, con su respectivo ID.

La respuesta de la API será un `status_code: 303` en lugar del `status_code: 200` que respondería normalmente.

La respuesta 303 es una redirección hacia la página donde será devuelto el resultado.

## URIs

La ejecución con espera se puede realizar utilizando `access_token`. Con `secret` no esta soportado y su uso esta desaconsejado.

| Method | Path | Description | ACL | 
| ---- |  ----|  ----|  ----|
| POST | /task/${id}/job | Iniciar ejecución de Tarea | user | 
| GET | /job/${id}/result | Obtener resultado de la ejecución | user | 


## Obtencion del resultado Async vs Sync

Mostraremos en este caso una como se realizaría una invocación sin espera y como sería lo mismo utilizando la espera con polling.

En este caso solo evaluaremos la opciones de iniciar y luego obtener el resultados con GET.
Exiten otras alternativas, utilizando eventos o socket, que están disponible en diferentes variantes pero quedan fuera del alcance de este documento.

## Async - comportamiento por defecto.

La ejecución de una Tarea se realizaría de la siguiente manera

<!-- tabs:start -->

#### **curl**

```bash
curl --request POST \
     --url "http://localhost:60080/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}" \
     --header 'content-type: application/json' \
     --include \ # include response headers
     --data '["arg1","arg2","arg3"]'
```

<!-- tabs:end -->

Se obtendría la siguiente respuesta

#### Headers

```shell
HTTP/1.1 200 OK
Server: restify
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Accept, Accept-Charset, Accept-Encoding, Accept-Version, Authorization, Cache-Control, Content-Length, Content-Type, Origin, User-Agent, X-Requested-With
Content-Type: application/json
Content-Length: 1653
Date: Mon, 10 Jul 2023 20:05:12 GMT
Connection: keep-alive
Keep-Alive: timeout=5
```

#### Body

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
  "agent_logging": false,
  "_type": "ScriptJob",
  "creation_date": "2023-07-10T20:05:12.921Z",
  "last_update": "2023-07-10T20:05:12.928Z",
  "output": [],
  "env": {
    "THEEYE_JOB": "{\"id\":\"64ac6478646bb71ee82e3a72\",\"task_id\":\"64ac0b46c06feba9b89ad795\"}",
    "THEEYE_JOB_USER": "{\"id\":\"64ac622ecfd3f6b8c04ff79c\",\"email\":\"files-8d9ee1278b525f17ee119ff6319ee4bacad390e2-integration@theeye.io\",\"username\":\"files-8d9ee1278b525f17ee119ff6319ee4bacad390e2-integration\"}",
    "THEEYE_JOB_WORKFLOW": "{}",
    "THEEYE_ORGANIZATION_NAME": "\"files\"",
    "THEEYE_API_URL": "\"http://127.0.0.1:60080\""
  },
  "task": {
    ...
  },
  "task_id": "64ac0b46c06feba9b89ad795",
  "host_id": "61702a45bd98993f55331c23",
  "host": {
    ...
  },
  "name": "Actualizar Indicador",
  "allows_dynamic_settings": true,
  "customer_id": "6170299c5e06094f81b1df52",
  "customer_name": "files",
  "state": "in_progress",
  "lifecycle": "ready",
  "user_id": "64ac622ecfd3f6b8c04ff79c",
  "notify": true,
  "origin": "user",
  "triggered_by": null,
  "script_id": "64ac0b46c06feba9b89ad79a",
  "script_runas": "node %script%",
  "timeout": 600000,
  "id": "64ac6478646bb71ee82e3a72",
  "user": {
    ...
  }
}

```

Luego sería necesarío buscar el resultado del la ejecución utilizando el endpoint de resultado especificando el formato deseado.


### Formatos de output

<!-- tabs:start -->


#### **output**

```bash
curl --url "http://localhost:60080/job/64ac6772be08c0252fb5ed1a/result?access_token=${accessToken}" \
       --header 'content-type: application/json' \
```

```js
["{\"message\":\"Hello world!\"}"]

```

#### **parse**


```bash
curl --url "http://localhost:60080/job/64ac6772be08c0252fb5ed1a/result?access_token=${accessToken}" \
       --header 'content-type: application/json' \
       -G --data-urlencode 'parse'
```

```js
{
  "message": "Hello world!"
}
```

#### **result**

```bash
curl --url "http://localhost:60080/job/64ac6772be08c0252fb5ed1a/result?access_token=${accessToken}" \
       --header 'content-type: application/json' \
       -G --data-urlencode 'result'
```

```js
{
  "code": 0,
  "log": "{\"state\":\"success\",\"data\":[{\"message\":\"Hello world!\"}]}\n",
  "lastline": "{\"state\":\"success\",\"data\":[{\"message\":\"Hello world!\"}]}",
  "signal": null,
  "killed": false,
  "times": {
    "seconds": 0,
    "nanoseconds": 50977309
  },
  "output": [
    {
      "message": "Hello world!"
    }
  ],
  "user": {
    "email": "files-agent@theeye.io",
    "username": "92fa22af8c23ec445d66b9dedd75fe6e353801db",
    "id": "6170299c5e06094f81b1df53"
  }
}
```


#### **full**

```bash
curl --url "http://localhost:60080/job/64ac6772be08c0252fb5ed1a/result?access_token=${accessToken}" \
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
  "creation_date": "2023-07-10T20:17:54.780Z",
  "last_update": "2023-07-10T20:17:56.367Z",
  "result": {
    "code": 0,
    "log": "{\"state\":\"success\",\"data\":[{\"message\":\"Hello world!\"}]}\n",
    "lastline": "{\"state\":\"success\",\"data\":[{\"message\":\"Hello world!\"}]}",
    "signal": null,
    "killed": false,
    "times": {
      "seconds": 0,
      "nanoseconds": 50977309
    },
    "output": [
      {
        "message": "Hello world!"
      }
    ],
    "user": {
      "email": "files-agent@theeye.io",
      "username": "92fa22af8c23ec445d66b9dedd75fe6e353801db",
      "id": "6170299c5e06094f81b1df53"
    }
  },
  "output": [
    // parsed output
    "{\"message\":\"Hello world!\"}"
  ],
  "env": {
    // JSON encoded environment variables
    "THEEYE_JOB": "{\"id\":\"64ac6772be08c0252fb5ed1a\",\"task_id\":\"64ac0b46c06feba9b89ad795\"}",
    "THEEYE_JOB_USER": "{\"id\":\"64ac622ecfd3f6b8c04ff79c\",\"email\":\"files-8d9ee1278b525f17ee119ff6319ee4bacad390e2-integration@theeye.io\",\"username\":\"files-8d9ee1278b525f17ee119ff6319ee4bacad390e2-integration\"}",
    "THEEYE_JOB_WORKFLOW": "{}",
    "THEEYE_ORGANIZATION_NAME": "\"files\"",
    "THEEYE_API_URL": "\"http://127.0.0.1:60080\""
  },
  "task": {
    "id": "64ac0b46c06feba9b89ad795",
    // embedded task entity
  },
  "task_id": "64ac0b46c06feba9b89ad795",
  "host_id": "61702a45bd98993f55331c23",
  "host": "61702a45bd98993f55331c23",
  "name": "Actualizar Indicador",
  "allows_dynamic_settings": true,
  "customer": "6170299c5e06094f81b1df52",
  "customer_id": "6170299c5e06094f81b1df52",
  "customer_name": "files",
  "state": "success",
  "lifecycle": "finished",
  "user_id": "64ac622ecfd3f6b8c04ff79c",
  "notify": true,
  "origin": "user",
  "triggered_by": null,
  "script": {
    // embedded script entity
    "id": "64ac0b46c06feba9b89ad79a",
    ...
  },
  "script_id": "64ac0b46c06feba9b89ad79a",
  "script_runas": "node %script%",
  "timeout": 600000,
  "trigger_name": "success",
  "id": "64ac6772be08c0252fb5ed1a"
}


```
<!-- tabs:end -->


## Sync - espera con polling

La espera con polling se logra mediante una redirección automática al endpoint de resultado inmediatamente después de la creación de un job.
Si la ejecución se resuelve antes de llegar a la dirección de resultado el output de la ejecución es devuelto inmediatamente.

En un caso donde la ejecución demora unos minutos, se inicia un proceso automático de polling con tiempos de espera predefinidos.
De esta forma se inicia un loop de redirecciones con polling automático.


### Inciar una solicitud con polling

La diferencia entre la ejecución con `wait_result=true` se puede ver en los headers de respuesta de la invocación.

Las dos formas de especificar la espera son por querystring o por json body. 
El formato utilizado en este caso va a depender de la forma en que seran provistos los argumentos de tarea

<!-- tabs:start -->

#### **json body**

```bash
 curl --location \
   --include \
   --request POST \
   --url "http://localhost:60080/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}" \
   --header 'content-type: application/json' \
   -d '{"wait_result":true}'
```

#### **querystring**

```bash
 curl 
   --location \
   --include \
   --request POST \
   --url "http://localhost:60080/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}&wait_result=true" 
```
<!-- tabs:end -->

En ambos casos la respuesta tendrá el mismo body que la ejecución Async, pero los headers serán distintos.

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

Esto indica que la solicitud esta siendo redireccionada a otra URL.

Con el comando curl se deben utilizar los parámetro --location y --max-redirs para el parseo automático de los encabezados,


#### Header Location

La redirección va acompañada del Header Location que indica a donde debe ser redirigido para continuar con el polling.

El header Location continue la URL donde se puede obtener la respuesta como vimos anteriormente.
Además se sumaron algunos parámetros de control adicionales que analizaremos a continuación.

### Configuración del polling automático

El polling automático se inicia con una solicitud a la URL de obtención de resultado `/job/${id}/result`

| Parametro | Descripcion |
| ----- | ----- |
| `/job/${id}/result` | URL Bearer con jobId |
| `counter=0` | cantidad de veces que se ejecuto el GET de resultado. |
| `limit=10` | cantidad máxima de GET que se van a ejecutar. Cuando `counter === limit` se detendrá el polling. |
| `timeout=5` | tiempo máximo (request timeout) que el servidor mantendrá viva la conexión esperando el resultado del job antes continuar con los chequeos y avanzar al siguiente loop o dar por terminado el polling. |

Utilizando todos estos parámetro en combinación se puede configurar el tiempo máximo de espera del resultado.

## Ejemplo

6 iteraciones (limit=6) de 10 segundos cada una (timeout=10) nos dara como resultado una espera de 1 minuto.

Para esperar el resultado de la ejecución de una tarea por un máximo de 50 segundos y obtener el output como un objeto en formato JSON, debemos iniciar el nuevo job con los siguientes parámetros


* limit=6

* timeout=10

* parse

* wait_result=true


```bash
curl --request POST \
     --include \
     --location \
     --url "http://localhost:60080/task/64ac0b46c06feba9b89ad795/job?access_token=${accessToken}&limit=6&timeout=10&wait_result=true&parse" \
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
