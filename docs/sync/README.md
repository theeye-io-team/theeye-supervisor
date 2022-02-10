[![theeye.io](../../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/index.html)

# API Sync

Ejecución sincrónica de tareas.

## URL

**https://sync.theeye.io**

____

La ejecución de tareas individuales en TheEye es asincrónica por la naturaleza de los procesos.
Esto se debe a que las tareas en general son ejecutadas en lotes mediante el uso de "Queues". El tiempo y la complejidad varía en cada implementación.
Habitualmente no necesitamos esperar el resultado de forma instantanea.

En algunos casos es necesario obtener el resultado de la ejecución de forma inmediata.
Este es aún común si necesitamos que las tareas se comporten como si fueran métodos de una API Rest.

Este comportamiento puede ser logrado utilizando la API en modo Sync.
Cualquier tarea puede ser utilizada mediante la API Sync. Es necesario tener en cuenta que con tiempo de ejecución muy largos se pueden producir Timeouts o incluso el orquestador puede cortar la comunicación de forma repentina.

Un tiempo de respuesta razonable no debe superar los 60 segundos de ejecución

___


## Rutas

| Method | Path | Description | ACL | 
| ---- |  ----|  ----|  ----|
| POST | /${customer}/task/${id}/job | [Run task](#waiting-output) | user | 


## Argumentos


| Name | Values | Description | 
| ---- |  ---- |  ---- |
| result | empty/null. is ignored | Result es la información informada por el Agente al finalizar la ejecución. En otros incluye execution log, output, lastline. | 
| full | empty/null. is ignored | Responde con el document Job completo asociado a la ejecución. El mismo documento puede ser obtenido haciendo un GET a la API de jobs |  
| parse | empty or a Number/Integer > 0 | El output de un job es almacenado en la base de datos como un Array de Strings, que si fuera encadenado serán argumentos de la siguiente tarea. La opción parse utilizara por defecto el índice 0 de este array de outputs y lo intentara interpretar como JSON.  En algunos casos puede ser necesario utilizar un índice diferente al 0, sobre todo si se trabaja con outputs de tareas ya definidios en otras implementaciones. Usando parse=INDEX_NUM donde INDEX_NUM es un número entero del output. Si el índice no esta presente o no es posible interpretarlo se devuelve el output crudo |


## Respuesta


Por defecto la API Sync responde con el output obtenido de la ejecución de la tarea. El output es lo que desde la interfaz se visualiza en la sección "output" del resultado de la ejecución.

El output se almacena en la base de datos dentro del documento job. El job representa la instancia de ejecución de la tarea.


| State | HTTP Status Code | 
| ---- |  ---- |
| success | 200 | 
| failure | 500 | 


### NOTES

* Por el momento solo es posible la ejecución de _Tareas Individuales_ .


____


## Ejemplos

Puede descargar e importa [esta receta utilizada para todos los ejemplos](/sync/Rest_API_Response.json ":ignore")


### Esperando output

```bash

customer=""
taskId=""
token=""

curl -s -X POST "https://sync.theeye.io/${customer}/task/${taskId}/job?access_token=${token}" | jq .output


```

### Ejemplo de resultado "failure"


```bash

curl -i -X POST 'https://sync.theeye.io/${customer_id}/task/${task_id}/job?access_token=${token}' \
       --header 'content-type: application/json' \
       --data '{"task_arguments":[200]}'

```


```http

HTTP/1.1 500 Internal Server Error
X-Powered-By: Express
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Origin, Accept, User-Agent, Accept-Charset, Cache-Control, Accept-Encoding, Content-Type, Authorization, Content-Length, X-Requested-With
Content-Type: application/json; charset=utf-8
Content-Length: 135
ETag: W/"87-+Fzdxc2Q7NsFIfhclF3lcqgSScY"
Date: Fri, 28 Jan 2022 16:59:54 GMT
Connection: keep-alive
Keep-Alive: timeout=5

["{\"message\":\"Validation Error. Invalid Argument Value\",\"statusCode\":418,\"name\":\"ClientError\",\"code\":\"\",\"status\":418}"]


```

### Ejemplo de resultado "success"


```bash

curl -i -X POST 'https://sync.theeye.io/${customer_id}/task/${task_id}/job?access_token=${token}' \
       --header 'content-type: application/json' \
       --data '{"task_arguments":[100]}'

```

```http

HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Origin, Accept, User-Agent, Accept-Charset, Cache-Control, Accept-Encoding, Content-Type, Authorization, Content-Length, X-Requested-With
Content-Type: application/json; charset=utf-8
Content-Length: 62
ETag: W/"3e-Earn8PE7JwarkhTciq4Sn4inI3g"
Date: Fri, 28 Jan 2022 17:00:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5

["{\"name\":\"tomer\",\"date\":\"2022-01-28T17:00:22.676Z\"}"]

```


### Ejemplo de "success" usando "parse"


Get the ID and replace in the requests below

```bash

curl -i -X POST 'https://sync.theeye.io/${customer_id}/task/${task_id}/job?parse&access_token=${token}' \
       --header 'content-type: application/json' \
       --data '{"task_arguments":[100]}'

```


```http

HTTP/1.1 200 OK
X-Powered-By: Express
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Origin, Accept, User-Agent, Accept-Charset, Cache-Control, Accept-Encoding, Content-Type, Authorization, Content-Length, X-Requested-With
Content-Type: application/json; charset=utf-8
Content-Length: 50
ETag: W/"32-QGrCXrCY2sEcc1V/fL6omhdvPKY"
Date: Fri, 28 Jan 2022 16:26:41 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"name":"tomer","date":"2022-01-28T16:26:41.201Z"}

```

### Ejemplo de "failure" usando "parse"


```bash

curl -i -X POST 'https://sync.theeye.io/${customer_id}/task/${task_id}/job?parse&access_token=${token}' \
       --header 'content-type: application/json' \
       --data '{"task_arguments":[200]}'

```


```http

HTTP/1.1 418 I'm a Teapot
X-Powered-By: Express
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: Origin, Accept, User-Agent, Accept-Charset, Cache-Control, Accept-Encoding, Content-Type, Authorization, Content-Length, X-Requested-With
Content-Type: application/json; charset=utf-8
Content-Length: 115
ETag: W/"73-FBmPIgGdDNzn6NM27joxlSUMWp4"
Date: Fri, 28 Jan 2022 16:56:47 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"message":"Validation Error. Invalid Argument Value","statusCode":418,"name":"ClientError","code":"","status":418}

```

