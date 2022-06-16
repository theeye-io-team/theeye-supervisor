[![theeye.io](../../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/index.html)

# Task ACL's API

## Endpoints de API

| Method | Path            | Description                                | ACL     |
| ------ | --------------- | ------------------------------------------ | ------- |
| GET    | /task/${id}/acl | [Obtener ACL de una tarea](#ejemplo-1)     | manager |
| PUT    | /task/${id}/acl | Reemplazar ACL                             | manager |
| PATCH  | /task/${id}/acl | [Actualizar ACL de una tarea](#ejemplo-3)  | manager |
| DELETE | /task/${id}/acl | Borrar ACL de una tarea                    | manager |

### NOTAS

* *access_token* (OBLIGATORIO)
  
  > Puede inclurse en el Authorization header \(`Authorization: Bearer ${token}`\)

  > Puede inclurse en el query string como ?access_token=

-----

## Ejemplos

##### Nota:

Es necesario

> Token de Acceso de usuario con los [permisos mínimos definidos en ACL](#endpoints-de-api)

> Id de la Tarea

### **Ejemplo 1** 

#### Obtener ACL de una tarea 

En este ejemplo enviaremos un GET request que nos devolverá la lista ACL de la tarea

<!-- tabs:start -->

##### **Javascript**

```javascript
const theeyeAccessToken = ''
const taskId = ''
let xhr = new XMLHttpRequest();
xhr.open('GET', `https://supervisor.theeye.io/task/${taskId}/acl?access_token=${theeyeAccessToken}`);

xhr.onload = () => {
  console.log(JSON.parse(xhr.response))
}

xhr.send(null)
```

##### **Bash**

```bash
#!/bin/bash

taskId=""
theeyAccessToken=""

curl -sS "https://supervisor.theeye.io/task/${taskId}/acl?access_token=${theeyAccessToken}"

```

##### **Node.js**

```javascript
const https = require('https')

const taskId = ''
const theeyeAccessToken = ''

const options = {
  host: 'supervisor.theeye.io',
  path: `/task/${taskId}/acl?access_token=${theeyeAccessToken}`,
  method: 'GET'
}

const req = https.request(options, res => {
  let data = ''

  res.on('data', d => {
    data = data + d
  })

  res.on('end', () => {
    console.log(JSON.parse(data))
  })
})

req.on('error', error => {
  console.error(error)
})

req.end()
```

##### **Python**

##### Nota:

> Para este ejemplo debe instalar la librería [`requests`](https://pypi.python.org/pypi/requests/) usando `pip`

```python
import os
import requests

taskId = ''
theeyeAccessToken = ''

url = "https://supervisor.theeye.io/task/" + taskId + "/acl"

params = {"access_token": theeyeAccessToken}

r = requests.get(url, params)

print(r.json())
```

<!-- tabs:end -->
