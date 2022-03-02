[![theeye.io](../../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/index.html)

# Tasks API

## Direcciones de API

| Method | Path                                                  | Description                                | ACL       |
| ------ | ----------------------------------------------------- | ------------------------------------------ | --------- |
| GET    | /${customer}/task                                     | [Enlistar tareas](#ejemplo-1)              | viewer    |
| GET    | /${customer}/task/${id}                               | [Buscar por ID](#ejemplo-2)                | viewer    |
| DELETE | /${customer}/task/${id}                               | Eliminar tarea                             | admin     |
| GET    | /${customer}/task/:task/recipe                        | Buscar receta                              | admin     |
| GET    | /${customer}/task/import                              | Crear desde receta                         | admin     |
| GET    | /${customer}/task/:task/credentials                   | Buscar credenciales de tarea               | admin     |
| POST   | /${customer}/task/${id}/job                           | Ejecutar tarea                             | user      |
| POST   | /${customer}/task/${id}/secret/${task_secret_key}/job | [Ejecutar tarea con su key](#ejemplo-3)    | anonymous |
| DELETE | /${customer}/task/${id}/job                           | Vaciar cola de jobs                        | admin     |

### NOTAS

* *customer* (OBLIGATORIO)
  
  > Puede incluirse en el cuerpo del request como `"customer"`  

* *access_token* (OBLIGATORIO)
  
  > Puede inclurse en el Authorization header \(`Authorization: Bearer ${token}`\)

-----

## Propiedades del Modelo

| Nombre de Propiedad | Nombre en la UI      | Tipo          | Descripción                                                                                                                                                                                          |
| ------------------- | -------------------- | ------------- |:---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name                | Name                 | string        | Nombre de la tarea                                                                                                                                                                                   |
| host_id             | Bots                 | string        | El host en el que se ejecuta                                                                                                                                                                         |
| script_id           | Script               | string        | El script que ejecuta                                                                                                                                                                                |
| tags                | Tags                 | strings array | Lista de etiquetas para identificar fácilmente                                                                                                                                                       |
| task_arguments      | Task Arguments       | array         | Los parámetros de la tarea a ejecutar. [Más información](https://documentation.theeye.io/theeye-web/#/es/core-concepts/tasks/?id=task-arguments)                                                     |
| run_as              | Run As               | string        | El comando que ejecuta la tarea. [Más información](../scripts/runas.md)                                                                                                                              |
| description         | Description          | string        | Una descripción de la tarea, puede (pero no se limita a) describir su funcionamiento y/o su output                                                                                                   |
| acls                | ACL's                | array         | Los usuarios que pueden ver la tarea \(los permisos dependen del tipo de usuario que sean\)                                                                                                          |
| triggers            | Triggered by         | array         | Eventos que dispararán la tarea automáticamente (opcional). [Más información](/core-concepts/tasks/triggers.md)                                                                                   |
| grace_time          | Trigger on-hold time | number        | Tiempo desde uno de los eventos definidos anteriormente hasta el disparo de la tarea                                                                                                                 |
| timeout             | Execution Timeout    | number        | Cuánto esperar la respuesta del servidor antes de cancelar ejecución. Si se excede el timeout, el Bot va a intentar detener la ejecución enviando señales de `SIGTERM` y `SIGKILL` (default **600**) |
| multitasking        | Multitasking         | boolean       | Permite a los Bots ejecutar multiples Jobs de esta tarea en paralelo                                                                                                                                 |
| env                 | Environment (env)    | string        | Declara variables de entorno extra para definir previo a la ejecución del script                                                                                                                     |

### NOTAS

* _timeout_
  
  > El timeout de ejecución por defecto son 10 minutos. <br>
  > Aún no es posible cambiar el timeout mediante la API. <br>
  > Para modificar el timeout de una tarea, utilice la interfaz Web.

-----

## Ejecutar tareas (Tasks)

Para ejecutar una **tarea**, se crea internamente un **Job** y se agrega a la cola de ejecución. Si se desea ejecutar una **tarea** solo necesita crear un **Job** manualmente y pasarle el ID de la tarea \(y sus opciones\) que quiere correr.

Nótese que en este ejemplo estamos ejecutando una tarea sin argumentos, y por ende `task_arguments` es un array vacío. Para ejecutar una tarea con argumentos, debe proveer la lista de argumentos correctamente ordenada en el parámetro `task_arguments`. Cada argumento debe ser una string de JSON escapada válida.

Esto puede hacerse fácilmente con un POST request al endpoint de Job de la API.

Hay 2 métodos disponibles: 

### Payload de ejecución de tarea/Workflow via API

Al crear Jobs de tareas mediante la API, tendrá que proveer el ID de la tarea y sus argumentos.

```javascript
{
  // (Obligatorio)
  task: "task id",
  // (Solo necesario si la tarea tiene argumentos)
  task_arguments: []
}
```

### Usando la Secret Key de la tarea (recomendado)

Todas las tareas y los Workflows tienen una **Secret Key**, una contraseña que se puede usar para invocarlos diréctamente desde la API. Estas contraseñas se asignan por tarea/Workflow y son **unicas para estos**, es decir, solo hay una Secret Key por tarea y Workflow.

Las Secret Keys pueden revocarse en cualquier momento tan solo cambiándolas, lo que hace este método el recomendado para acceder a la API gracias a su simpleza y seguridad. 

### Usando claves de integración general

Un usuario administrador puede crear una clave de integración (API Integration Token) desde la interfaz, la cual luego funciona para realizar múltiples operaciones desde la API. Para crearla, haga click en el ícono de su perfil, luego diríjase a *Settings* ➔ *Credentials* ➔ *Integration Tokens* 

> :warning: Las claves de integración tienen completos **permisos de ADMINISTRADOR**, almacénela en un lugar seguro

Revise el [ejemplo 4](#ejemplo-4) para más información

-----

## Ejemplos

### **Ejemplo 1** 

#### Enlistar tareas

En este ejemplo enviaremos un GET request que nos devolverá una lista de todas las tareas disponibles en una organización, con toda la información asociada a cada una de las mismas

<!-- tabs:start -->

##### **Bash**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la Secret Key de la tarea

```bash
#!/bin/bash

curl -sS "https://supervisor.theeye.io/$THEEYE_ORGANIZATION_NAME/task?access_token=$THEEYE_TOKEN"
```

##### **Javascript**

##### Nota:

> Se asume que están declaradas las variables `window.THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `window.THEEYE_TOKEN` como la Secret Key de la tarea

```javascript
let xhr = new XMLHttpRequest();
xhr.open('GET', `https://supervisor.theeye.io/${window.THEEYE_ORGANIZATION_NAME}/task?access_token=${window.THEEYE_TOKEN}`);

xhr.onload = () => {
  console.log(JSON.parse(xhr.response))
}

xhr.send(null)
```

##### **Node.js**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la Secret Key de la tarea

```javascript
const https = require('https')

const options = {
  host: 'supervisor.theeye.io',
  path: `/${process.env.THEEYE_ORGANIZATION_NAME}/task?access_token=${process.env.THEEYE_TOKEN}`,
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

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la Secret Key de la tarea
>
> También se asume que está instalada la librería [`requests`](https://pypi.python.org/pypi/requests/), de no tenerla puede instalarla usando `pip`

```python
import os
import requests

url = "https://supervisor.theeye.io/" + os.getenv("THEEYE_ORGANIZATION_NAME") + "/task"

params = {"access_token": os.getenv("THEEYE_TOKEN")}

r = requests.get(url, params)

print(r.json())
```

<!-- tabs:end -->

### **Ejemplo 2**

#### Buscar por ID

En este ejemplo enviaremos un GET request que nos devolverá una tarea con toda la información asociada a la misma

<!-- tabs:start -->

##### **Bash**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la Secret Key de la tarea

```bash
#!/bin/bash

# El ID de la tarea que se quiere solicitar
task_id="61098ee1a3013300120c687b"

curl -sS "https://supervisor.theeye.io/$THEEYE_ORGANIZATION_NAME/task/${task_id}?access_token=$THEEYE_TOKEN"
```

##### **Javascript**

##### Nota:

> Se asume que están declaradas las variables `window.THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `window.THEEYE_TOKEN` como la Secret Key de la tarea

```javascript
let xhr = new XMLHttpRequest();

// El ID de la tarea que se quiere solicitar
const task_id = "61098ee1a3013300120c687b"

xhr.open('GET', `https://supervisor.theeye.io/${window.THEEYE_ORGANIZATION_NAME}/task/${task_id}?access_token=${window.THEEYE_TOKEN}`);

xhr.onload = () => {
  console.log(JSON.parse(xhr.response))
}

xhr.send(null)
```

##### **Node.js**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la Secret Key de la tarea

```javascript
const https = require('https')

// El ID de la tarea que se quiere solicitar
const task_id = "61098ee1a3013300120c687b"


const options = {
  host: 'supervisor.theeye.io',
  path: `/${process.env.THEEYE_ORGANIZATION_NAME}/task/${task_id}?access_token=${process.env.THEEYE_TOKEN}`,
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

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la Secret Key de la tarea
>
> También se asume que está instalada la librería [`requests`](https://pypi.python.org/pypi/requests/), de no tenerla puede instalarla usando `pip`

```python
import os
import requests

# El ID de la tarea que se quiere solicitar
task_id = "61098ee1a3013300120c687b"

url = "https://supervisor.theeye.io/" + os.getenv("THEEYE_ORGANIZATION_NAME") + "/task/" + task_id

params = {"access_token": os.getenv("THEEYE_TOKEN")}

r = requests.get(url, params)

print(r.json())
```

<!-- tabs:end -->

### **Ejemplo 3**

### Ejecutar con la Secret Key

En este ejemplo enviaremos un POST request que ejecutará una tarea de nuestra elección, creando un Job para el agente. Debe proveerse el ID de la tarea y su Secret Key, ilustrado como argumentos de función. Devuelve información del Job que se creó.

<!-- tabs:start -->

##### **Bash**

##### Nota:

> Se asume que está declaradas las variable de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización
>
> Como BASH no permite devolver valores arbitrarios, se imprime el resultado en stdout. Si en su lugar desea guardarlo en una variable, puede ejecutar la función de la siguiente manera: <br/>
> `$ output=$(execTask "ID" "Secret")`

```bash
execTask () {
  task_id=$1
  task_secret_key=$2

  body='{ "customer": "'"$THEEYE_ORGANIZATION_NAME"'", "task": "'"$task_id"'" }'

  curl -sS \
    --request POST \
    --header "Accept: application/json" \
    --header "Content-Type: application/json" \
    --data ${body} \
    --url "https://supervisor.theeye.io/job/secret/${task_secret_key}"
}
```

##### **Javascript**

##### Nota:

> Se asume que está declarada las variable `window.THEEYE_ORGANIZATION_NAME` como el nombre de la organización
> 
> En este ejemplo, la función devuelve una `Promise` que se resuelve al completar el request

```javascript
const execTask = (task_id, task_secret_key) => {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();

    const body = {
      customer: window.THEEYE_ORGANIZATION_NAME,
      task: task_id
    }

    xhr.open('POST', `https://supervisor.theeye.io/job/secret/${task_secret_key}`);

    xhr.setRequestHeader("Accept", "application/json")
    xhr.setRequestHeader("Content-Type", "application/json")

    xhr.onload = () => {
      resolve(JSON.parse(xhr.response))
    }

    xhr.onerror = () => {
      reject(xhr.response)
    }

    xhr.send(JSON.stringify(body))
  })
}
```

##### **Node.js**

##### Nota:

> Se asume que está declaradas las variable de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización
> 
> En este ejemplo, la función devuelve una `Promise` que se resuelve al completar el request

```javascript
const https = require('https')

const execTask = (task_id, task_secret_key) => {
  return new Promise((resolve, reject) => {
    const body = {
      customer: process.env.THEEYE_ORGANIZATION_NAME,
      task: task_id
    }

    const options = {
      host: 'supervisor.theeye.io',
      path: `/job/secret/${task_secret_key}`,
      method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
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

    req.write(JSON.stringify(body))
    req.end()
  })
}
```

##### **Python**

##### Nota:
> Se asume que está declaradas las variable de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización
> 
> También se asume que está instalada la librería [`requests`](https://pypi.python.org/pypi/requests/), de no tenerla puede instalarla usando `pip`

```python
import os
import requests

def execTask(task_id, task_secret_key):
  url = "https://supervisor.theeye.io/job/secret/" + task_secret_key

  body = {
    "customer": os.getenv("THEEYE_ORGANIZATION_NAME"),
    "task": task_id
  }
  
  r = requests.post(url, body)
  return(r.json())
```

<!-- tabs:end -->

### **Ejemplo 4**

### Ejecutar con la clave de integración

En este ejemplo enviaremos un POST request que ejecutará una tarea de nuestra elección utilizando la clave de integración general. Debe proveerse el ID de la tarea y la clave de integración de la cuenta, ilustrado como argumentos de función. Devuelve información del Job que se creó.

TODO: PROBARLOS

<!-- tabs:start -->

##### **Bash**

##### Nota:

> Se asume que está declaradas las variable de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización
>
> Como BASH no permite devolver valores arbitrarios, se imprime el resultado en stdout. Si en su lugar desea guardarlo en una variable, puede ejecutar la función de la siguiente manera: <br/>
> `$ output=$(execTask "ID" "Secret")`

```bash
execTask () {
  task_id=$1
  access_token=$2

  body='{ "customer": "'"$THEEYE_ORGANIZATION_NAME"'", "task": "'"$task_id"'", "access_token": "'"$access_token"'" }'

  curl -sS \
    --request POST \
    --header "Accept: application/json" \
    --header "Content-Type: application/json" \
    --data ${body} \
    --url "https://supervisor.theeye.io/job"
}
```

##### **Javascript**

##### Nota:

> Se asume que está declarada las variable `window.THEEYE_ORGANIZATION_NAME` como el nombre de la organización
> 
> En este ejemplo, la función devuelve una `Promise` que se resuelve al completar el request

```javascript
const execTask = (task_id, access_token) => {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();

    const body = {
      customer: window.THEEYE_ORGANIZATION_NAME,
      task: task_id,
      access_token: access_token
    }

    xhr.open('POST', 'https://supervisor.theeye.io/job');

    xhr.setRequestHeader("Accept", "application/json")
    xhr.setRequestHeader("Content-Type", "application/json")

    xhr.onload = () => {
      resolve(JSON.parse(xhr.response))
    }

    xhr.onerror = () => {
      reject(xhr.response)
    }

    xhr.send(JSON.stringify(body))
  })
}
```

##### **Node.js**

##### Nota:

> Se asume que está declaradas las variable de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización
> 
> En este ejemplo, la función devuelve una `Promise` que se resuelve al completar el request

```javascript
const https = require('https')

const execTask = (task_id, access_token) => {
  return new Promise((resolve, reject) => {
    const body = {
      customer: process.env.THEEYE_ORGANIZATION_NAME,
      task: task_id,
      access_token: access_token
    }

    const options = {
      host: 'supervisor.theeye.io',
      path: '/job',
      method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
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

    req.write(JSON.stringify(body))
    req.end()
  })
}
```

##### **Python**

##### Nota:
> Se asume que está declaradas las variable de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización
> 
> También se asume que está instalada la librería [`requests`](https://pypi.python.org/pypi/requests/), de no tenerla puede instalarla usando `pip`

```python
import os
import requests

def execTask(task_id, access_token):
  url = "https://supervisor.theeye.io/job"

  body = {
    "customer": os.getenv("THEEYE_ORGANIZATION_NAME"),
    "task": task_id,
    "access_token": access_token
  }
  
  r = requests.post(url, body)
  return(r.json())
```

<!-- tabs:end -->
