[![theeye.io](../../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/index.html)

# Tasks API

## Direcciones de API

| Method | Path                                                  | Description                                | ACL       |
| ------ | ----------------------------------------------------- | ------------------------------------------ | --------- |
| GET    | /${customer}/task                                     | [Enlistar tareas](#ejemplo-1) <br> [Enlistar tareas y su timeout](#ejemplo-3)| viewer    |
| GET    | /${customer}/task/${id}                               | [Buscar por ID](#ejemplo-2)                | viewer    |
| DELETE | /${customer}/task/${id}                               | Eliminar tarea                             | admin     |
| GET    | /${customer}/task/:task/recipe                        | Buscar receta                              | admin     |
| GET    | /${customer}/task/import                              | Crear desde receta                         | admin     |
| GET    | /${customer}/task/:task/credentials                   | Buscar credenciales de tarea               | admin     |
| POST   | /${customer}/task/${id}/job                           | Ejecutar tarea                             | user      |
| POST   | /${customer}/task/${id}/secret/${task_secret_key}/job | [Ejecutar tarea con su key](#example-4)    | anonymous |
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
| triggers            | Triggered by         | array         | Eventos que dispararán la tarea automáticamente (opcional). [Más información](/es/core-concepts/tasks/triggers.md)                                                                                   |
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

-----

## Ejemplos

### **Ejemplo 1** 

#### Enlistar tareas

En este ejemplo enviaremos un GET request que nos devolverá una lista de todas las tareas disponibles en una organización, con toda la información asociada a cada una de las mismas

<!-- tabs:start -->

##### **Bash**

##### Nota:

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la clave de integración

```bash
#!/bin/bash

curl -sS "https://supervisor.theeye.io/$THEEYE_ORGANIZATION_NAME/task?access_token=$THEEYE_TOKEN"
```

##### **Javascript**

##### Nota:

> Se asume que están declaradas las variables `window.THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `window.THEEYE_TOKEN` como la clave de integración

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

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la clave de integración

```javascript
var http = require('http');

var options = {
  host: 'supervisor.theeye.io',
  path: `/${process.env.THEEYE_ORGANIZATION_NAME}/task?access_token=${process.env.THEEYE_TOKEN}`,
  method: 'GET'
};

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

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la clave de integración
>
> También se asume que está instalada la librería `requests`, de no tenerla puede instalarla usando `pip`

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

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la clave de integración

```bash
#!/bin/bash

# El ID de la tarea que se quiere solicitar
task_id="61098ee1a3013300120c687b"

curl -sS "https://supervisor.theeye.io/$THEEYE_ORGANIZATION_NAME/task/${task_id}?access_token=$THEEYE_TOKEN"
```

##### **Javascript**

##### Nota:

> Se asume que están declaradas las variables `window.THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `window.THEEYE_TOKEN` como la clave de integración

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

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la clave de integración

```javascript
var http = require('http');

// El ID de la tarea que se quiere solicitar
const task_id = "61098ee1a3013300120c687b"


var options = {
  host: 'supervisor.theeye.io',
  path: `/${process.env.THEEYE_ORGANIZATION_NAME}/task/${task_id}?access_token=${process.env.THEEYE_TOKEN}`,
  method: 'GET'
};

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

> Se asume que están declaradas las variables de entorno `THEEYE_ORGANIZATION_NAME` como el nombre de la organización y `THEEYE_TOKEN` como la clave de integración
>
> También se asume que está instalada la librería `requests`, de no tenerla puede instalarla usando `pip`

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

#### Enlistar tareas y su timeout

(Timeout = null) means that the timeout is set to default (10 minutes).

```bash
#!/bin/bash

customer=$1
access_token=$THEEYE_TOKEN
supervisor=$2
if [ $2 == "" ]; then supervisor='https://supervisor.theeye.io' ; fi
if [ $# -ne 2 ]; then echo "missing parameters" ; exit ; fi

data=$(curl -s ${supervisor}/${customer}/task?access_token=${access_token})

echo "${data}" | jq -j '.[] | "id: ", .id, "\ttask: ", .name, "\ttimeout: ", .timeout, "\n"'
```

### **Example 4**

### Execute using secret key

```bash
task_id=$TASK_ID
task_secret_key=$TASK_SECRET
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')

curl -i -sS \
  --request POST \
  --header "Accept: application/json" \
  --header "Content-Type: application/json" \
  --data-urlencode "customer = ${customer}" \
  --data-urlencode "task = ${task_id}" \
  --url "https://supervisor.theeye.io/job/secret/${task_secret_key}"
```

### **Example 5**

### HTML Button

This technique could be combined with an HTML form to generate an action button.
This is very handy when it is needed to perform actions from email bodies or static web pages.

```html
<html>
<head><title>Sample approval request</title></head>
<body></body>
<script>
var secret = ""
var taskId = ""
var customerName = ""
var template = [
  "<div>",
    '<span>Approve please!</span>',
    '<form action="http://supervisor.theeye.io/job/secret/' + secret + '" method=POST>',
      '<input type="hidden" name="customer" value="' + customerName + '">',
      '<input type="hidden" name="task" value="' + taskId + '">',
      '<input type="hidden" name="task_arguments[]" value="arg1">',
      '<input type="hidden" name="task_arguments[]" value="arg2">',
      '<input type="submit" value="ACEPTO">',
    '</form>',
  '</div>',
].join("")

document.body.innerHTML = template

</script>
</html>
```

### **Example 6**

### API integration tokens

Integration Tokens can be obtained only by admin users.

<h2 style="color:red"> Integration Tokens has full admin privileges. Keep it safe</h2>

Accessing to the web interfaz *Menu > Settings > Credentials > Integration Tokens*.

```bash
task_id=$TASK_ID
access_token=$ACCESS_TOKEN
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')


curl -X POST \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d "{\"task_arguments\":[]}" \
  "https://supervisor.theeye.io/job?access_token=${access_token}&customer=${customer}&task=${task_id}"
```

The API response is a the created job. We can save the job id and use it later to query the job status.
