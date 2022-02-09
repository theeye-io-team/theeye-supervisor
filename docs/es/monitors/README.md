# API para Monitores

[![theeye.io](../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

## URL de la API para Monitores

```javascript
`https://supervisor.theeye.io/monitor?access_token=${THEEYE_ACCESS_TOKEN}&customer=${THEEYE_ORGANIZATION_NAME}`
```

| Method | Path           | Description                                    | ACL    |
| ------ | -------------- | ---------------------------------------------- | ------ |
| GET    | /monitor       | [Enlistar Monitores](#ejemplo-1)               | viewer |
| GET    | /monitor/${id} | [Mostrar un Monitor por su ID](#ejemplo-5)     | viewer |
| POST   | /monitor       | [Crea un Monitor](#ejemplo-4)                  | admin  |
| DELETE | /monitor/${id} | [Elimina el Monitor](#ejemplo-3)               | admin  |



### Variables:
  * **customer**: Nombre de la organización.
  * **access token**: Clave de integración. [Más información](/es/auth#identificadores-de-integración-integration-tokens)

## Ejemplos

### **Ejemplo 1**

#### Enlistar Monitores

En este ejemplo enviaremos un GET request que nos devolverá una lista de todos los monitores de una organización.

<!-- tabs:start -->

##### **Bash**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_ACCESS_TOKEN` como la Secret Key de la tarea

```bash
#!/bin/bash
curl -sS "https://supervisor.theeye.io/monitor?access_token=${THEEYE_ACCESS_TOKEN}&customer=${THEEYE_ORGANIZATION_NAME}"
```

##### **Javascript**

##### Nota:

> Se asume que están declaradas las variables `window.THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `window.THEEYE_TOKEN` como la Secret Key de la tarea

```javascript
let xhr = new XMLHttpRequest();
xhr.open('GET', `https://supervisor.theeye.io/monitor?access_token=${window.THEEYE_ACCESS_TOKEN}&customer=${window.THEEYE_ORGANIZATION_NAME}`);

xhr.onload = () => {
  console.log(JSON.parse(xhr.response))
}

xhr.send(null)
```

##### **Node.js**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_ACCESS_TOKEN` como la Secret Key de la tarea

```javascript
const https = require('https')

const options = {
  host: 'supervisor.theeye.io',
  path: `/monitor?access_token=${process.env.THEEYE_ACCESS_TOKEN}&customer=${process.env.THEEYE_ORGANIZATION_NAME}`,
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

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_ACCESS_TOKEN` como la Secret Key de la tarea
>
> También se asume que está instalada la librería [`requests`](https://pypi.python.org/pypi/requests/), de no tenerla puede instalarla usando `pip`

```python
import os
import requests

url = "https://supervisor.theeye.io/monitor"

params = {
  "access_token": os.getenv("THEEYE_ACCESS_TOKEN"),
  "customer": os.getenv("THEEYE_ORGANIZATION_NAME")
}

r = requests.get(url, params)

print(r.json())
```

<!-- tabs:end -->

#### **Ejemplo 2**

##### **Filtrar lista de monitores**

Igual al ejemplo anterior, pero podemos filtrar la lista usando el argumento `where`. En el mismo contiene un parámetro y su respectivo valor, y dicho parámetro puede ser cualquiera de las propiedades del modelo de Monitor. Esto devuelve una lista con todos los monitores que coinciden con el filtro. En este caso, queremos buscar solo los Monitores cuyo `state` sea `normal`.

<!-- tabs:start -->

##### **Bash**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_ACCESS_TOKEN` como la Secret Key de la tarea
> 
> En el ejemplo definiremos el parámetro por el que queremos filtrar en la variable `key`, y el valor esperado en la variable `value`

```bash
#!/bin/bash
key="state"
value="normal"

curl -sS "https://supervisor.theeye.io/monitor?access_token=${THEEYE_ACCESS_TOKEN}&customer=${THEEYE_ORGANIZATION_NAME}&where\[${key}\]=${value}"
```

##### **Javascript**

##### Nota:

> Se asume que están declaradas las variables `window.THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `window.THEEYE_TOKEN` como la Secret Key de la tarea
> 
> En el ejemplo definiremos el parámetro por el que queremos filtrar en la variable `key`, y el valor esperado en la variable `value`

```javascript
const key = "state";
const value = "normal";

let xhr = new XMLHttpRequest();
xhr.open('GET', `https://supervisor.theeye.io/monitor?access_token=${window.THEEYE_ACCESS_TOKEN}&customer=${window.THEEYE_ORGANIZATION_NAME}&where\[${key}\]=${value}`);

xhr.onload = () => {
  console.log(JSON.parse(xhr.response))
}

xhr.send(null)
```

##### **Node.js**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_ACCESS_TOKEN` como la Secret Key de la tarea
> 
> En el ejemplo definiremos el parámetro por el que queremos filtrar en la variable `key`, y el valor esperado en la variable `value`.

```javascript
const https = require('https')

const key = "state";
const value = "normal";

const options = {
  host: 'supervisor.theeye.io',
  path: `/monitor?access_token=${process.env.THEEYE_ACCESS_TOKEN}&customer=${process.env.THEEYE_ORGANIZATION_NAME}&where\[${key}\]=${value}`,
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

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_ACCESS_TOKEN` como la Secret Key de la tarea
>
> También se asume que está instalada la librería [`requests`](https://pypi.python.org/pypi/requests/), de no tenerla puede instalarla usando `pip`
> 
> En el ejemplo definiremos el parámetro por el que queremos filtrar en la variable `key`, y el valor esperado en la variable `value`

```python
import os
import requests

key = "state"
value = "normal"

url = "https://supervisor.theeye.io/monitor"

params = {
  "access_token": os.getenv("THEEYE_ACCESS_TOKEN"),
  "customer": os.getenv("THEEYE_ORGANIZATION_NAME"),
  "where\[" + key + "\]" : value
}

r = requests.get(url, params)

print(r.json())
```

<!-- tabs:end -->

#### **Ejemplo 3**

##### **Mostrar un monitor por su ID**

En este ejemplo enviaremos un GET request que nos devolverá el Monitor asosciado al ID provisto en la URL

<!-- tabs:start -->

##### **Bash**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_ACCESS_TOKEN` como la Secret Key de la tarea

```bash
#!/bin/bash

# El ID del monitor que se quiere solicitar
monitor_id="60d2586a830e950019051dc0"

curl -sS "https://supervisor.theeye.io/monitor/${monitor_id}?access_token=${THEEYE_ACCESS_TOKEN}&customer=${THEEYE_ORGANIZATION_NAME}"
```

##### **Javascript**

##### Nota:

> Se asume que están declaradas las variables `window.THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `window.THEEYE_TOKEN` como la Secret Key de la tarea

```javascript
// El ID del monitor que se quiere solicitar
const monitor_id = "60d2586a830e950019051dc0"

let xhr = new XMLHttpRequest();
xhr.open('GET', `https://supervisor.theeye.io/monitor/${monitor_id}?access_token=${window.THEEYE_ACCESS_TOKEN}&customer=${window.THEEYE_ORGANIZATION_NAME}`);

xhr.onload = () => {
  console.log(JSON.parse(xhr.response))
}

xhr.send(null)
```

##### **Node.js**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_ACCESS_TOKEN` como la Secret Key de la tarea

```javascript
const https = require('https')

// El ID del monitor que se quiere solicitar
const monitor_id = "60d2586a830e950019051dc0"

const options = {
  host: 'supervisor.theeye.io',
  path: `/monitor/${monitor_id}?access_token=${process.env.THEEYE_ACCESS_TOKEN}&customer=${process.env.THEEYE_ORGANIZATION_NAME}`,
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

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_ACCESS_TOKEN` como la Secret Key de la tarea
>
> También se asume que está instalada la librería [`requests`](https://pypi.python.org/pypi/requests/), de no tenerla puede instalarla usando `pip`

```python
import os
import requests

# El ID del Monitor que se quiere solicitar
monitor_id = "60d2586a830e950019051dc0"

url = "https://supervisor.theeye.io/monitor/" + monitor_id

params = {
  "access_token": os.getenv("THEEYE_ACCESS_TOKEN"),
  "customer": os.getenv("THEEYE_ORGANIZATION_NAME")
}

r = requests.get(url, params)

print(r.json())
```

<!-- tabs:end -->



#### **Example 4**

##### **Delete Monitor**
```bash

customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
id_monitor=$1

curl -X DELETE "https://supervisor.theeye.io/monitor/${id_monitor}?access_token=${token}&customer=${customer}"
```


#### **Example 5**

##### **Create Web Check Monitor**

```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
host_id=$1
url=$2
monitorName=$3

curl -sS -X POST "https://supervisor.theeye.io/monitor?access_token=${token}&customer=${customer}&host_id=${host_id}" \
--header 'Content-Type: application/json' \
--data "{\"name\":\"${monitorName}\",\"host_id\":\"${host_id}\",\"url\":\"${url}\",\"timeout\":\"5000\",\"looptime\":\"15000\",\"type\":\"scraper\",\"status_code\":\"200\",\"_type\":\"ScraperMonitor\"}"
```
#### **Example 6**

##### **Get Monitor by Id**

```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.') token=$THEEYE_ACCESS_TOKEN
id_monitor=$1


curl -sS -X GET "https://supervisor.theeye.io/monitor/${id_monitor}?access_token=${token}&customer=${customer}"
```
#### **Example 7**

##### **Get Monitor by name**

```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.') 
token=$THEEYE_ACCESS_TOKEN
nameMonitor=$1


curl -sS -X GET "https://supervisor.theeye.io/monitor?access_token=${token}&where\[name\]=${nameMonitor}"
```




