[![theeye.io](../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Sync API

## URL

**https://sync.theeye.io**

____

Tasks execution in TheEye is asynchronous by nature. This means, that task will get executed and then continue in background an the time it takes to complete varies. Usually, we do not need to wait the result and we can check it later.                                                    

But there are cases when we need to invoke the task and we want to wait the result. This is very common when connecting apis, using task with interfaces that requires user interaction and many other escenarios. 

This can be achived using the API in sync mode. The only restriction is the task execution timeout. A recommended timeout would be between 10 to 30 seconds maximum. Most of the web client will abort the request near the 60 seconds. Clients behaviour can be configured and changed but experience tells us that it is not recommended, unless you really need it.

___


## API Paths

| Method | Path | Description | ACL | 
| ---- |  ----|  ----|  ----|
| POST | /${customer}/task/${id}/job | [Run task](#waiting-output) | user | 


### NOTES

* Single **Task execution** is supported. Workflows execution is **NOT Possible** at this moment.

___


## Examples

### Waiting output

```bash

customer=""
taskId=""
token=""

curl -s -X POST "https://sync.theeye.io/${customer}/task/${taskId}/job?access_token=${token}" | jq .output


```
