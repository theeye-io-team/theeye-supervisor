[![theeye.io](../../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/index.html)

# Sync API

## URL

**https://sync.theeye.io**

____

Tasks execution in TheEye is asynchronous by nature. This means, that task will get executed and then continue in background an the time it takes to complete varies. Usually, we do not need to wait the result and we can check it later.                                                    

But there are cases when we need to invoke the task and we want to wait the result. This is very common when connecting apis, using task with interfaces that requires user interaction and many other escenarios. 

This can be achived using the API in sync mode. The only restriction is the task execution timeout. A recommended timeout would be between 10 to 30 seconds maximum. Most of the web client will abort the request near the 60 seconds. Clients behaviour can be configured and changed but experience tells us that it is not recommended, unless you really need it.

___


## Paths

| Method | Path | Description | ACL | 
| ---- |  ----|  ----|  ----|
| POST | /${customer}/task/${id}/job | [Run task](#waiting-output) | user | 


## Arguments


| Name | Values | Description | 
| ---- |  ---- |  ---- |
| result | empty/null. is ignored | Result is another field stored with the job execution data in the database. This includes the execution log, the output, the lastline. | 
| full | empty/null. is ignored | This is the full job document. This is the same value that can be obtained doing a GET request to the jobs api |  
| parse | empty or a Number/Integer > 0 | The output of a job is always stored in the database as an array of Task Arguments strings.  The parse option will use the index number 0 of the output and parse it as JSON.  In some cases you might need to return a specific index of the output array. Using parse, set it to the a number from 0 to N, representing the index of the output array.  If the index is not present or if it is unreadable the raw output will be returned |  


## Response

By default the sync api will respond with the final output of the task execution. when a job finishes the output value is parsed and then stored withing the job document in the output field.

| State | HTTP Status Code | 
| ---- |  ---- |
| success | 200 | 
| failure | 500 | 


### NOTES

* Single **Task execution** is supported. Workflows execution is **NOT Possible** at this moment.

______


## Examples

### Waiting output

```bash

customer=""
taskId=""
token=""

curl -s -X POST "https://sync.theeye.io/${customer}/task/${taskId}/job?access_token=${token}" | jq .output


```

### sample failure


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

### sample success


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


###  sample success using parse

[Download and Import this task](/sync/Rest_API_Response.json ":ignore")


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

###  sample failure using parse


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

