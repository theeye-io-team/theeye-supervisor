[![theeye.io](../../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/index.html)

# Información de Runtime

Durante runtime, se puede consultar información del job que se está ejecutando mediante variables de entorno.

Toda la información está guardada en strings o estructuras JSON, y puede consultarla mediante las variables de entorno del runtime de TheEye. Las mismas son fácil de identificar ya que empiezan con el prefijo `THEEYE_`.

## `THEEYE_JOB` (objeto)

Contiene la información del job que se está ejecutando.

| Nombre  | Tipo   | Descripción                                                               |
| ------- | ------ | ------------------------------------------------------------------------- |
| id      | string | El ID del job. Se puede usar para consultar a la API                      |
| task_id | string | El ID de la task que generó el job. Se puede usar para consultar a la API |

### Ejemplo 

<!-- tabs:start -->

#### **Node.JS**

```javascript
console.log(JSON.parse(process.env.THEEYE_JOB))
```

#### **Bash**

Para analizar un objeto JSON en una string haremos uso del paquete `jq`. [Mas información](https://stedolan.github.io/jq/)

```bash
echo "$THEEYE_JOB" || jq .
```

#### **PowerShell**

```powershell
$env:THEEYE_JOB | convertfrom-json | convertto-json -depth 100 | Write-Host
```

#### **Python**

```python
import os
import json

print(json.loads(os.environ.get("THEEYE_JOB")))
```

<!-- tabs:end -->


## `THEEYE_JOB_USER` (objeto)

Este es el usuario que ejecutó la task y creó el job. Esta variable va a contener distintos parámetros dependiendo de cómo se haya ejecutado

* **Ejecución automática:** El usuario va a ser siempre un bot interno.
* **Botón Play:** El usuario va a ser quien que haya ejecutado la tarea desde la interfaz web.
* **Llamada a la API:** Las llamadas a la API pueden hacerse con *Integration Keys* (el usuario sería un bot) o con *Access Tokens* (el usuario sería humano).

| Nombre | Tipo   | Descripción       |
| ------ | ------ | ----------------- |
| id     | string | ID interno del usuario |
| email  | string | email del usuario |
| username  | string | nombre de usuario |

### Ejemplo 

<!-- tabs:start -->

#### **Node.JS**

```javascript
console.log(JSON.parse(process.env.THEEYE_JOB_USER))
```

#### **Bash**

Para analizar un objeto JSON en una string haremos uso del paquete `jq`. [Mas información](https://stedolan.github.io/jq/)

```bash
echo "$THEEYE_JOB_USER" || jq .
```

#### **PowerShell**

```powershell
$env:THEEYE_JOB_USER | convertfrom-json | convertto-json -depth 100 | Write-Host
```

#### **Python**

```python
import os
import json

print(json.loads(os.environ.get("THEEYE_JOB_USER")))
```

<!-- tabs:end -->

## `THEEYE_JOB_WORKFLOW` (objeto)

Cuando las tareas son parte de un Workflow, esta variable contendrá información del mismo.

| Nombre  | Tipo   | Descripción                       |
| ------- | ------ | --------------------------------- |
| id      | string | Schema ID del workflow            |
| job_id  | string | La instancia de ejecución del job |

### Ejemplo 

<!-- tabs:start -->

#### **Node.JS**

```javascript
console.log(JSON.parse(process.env.THEEYE_JOB_WORKFLOW))
```

#### **Bash**

Para analizar un objeto JSON en una string haremos uso del paquete `jq`. [Mas información](https://stedolan.github.io/jq/)

```bash
echo "$THEEYE_JOB_WORKFLOW" || jq .
```

#### **PowerShell**

```powershell
$env:THEEYE_JOB_WORKFLOW | convertfrom-json | convertto-json -depth 100 | Write-Host
```

#### **Python**

```python
import os
import json

print(json.loads(os.environ.get("THEEYE_JOB_WORKFLOW")))
```

<!-- tabs:end -->

## `THEEYE_API_URL` (string)

La URL de la API por defecto

### Ejemplo 

<!-- tabs:start -->

#### **Node.JS**

```javascript
console.log(process.env.THEEYE_API_URL)
```

#### **Bash**

```bash
echo "$THEEYE_API_URL" 
```

#### **PowerShell**

```powershell
$env:THEEYE_API_URL 
```

#### **Python**

```python
import os

print(os.environ.get("THEEYE_API_URL"))
```

<!-- tabs:end -->

## `THEEYE_ORGANIZATION_NAME` (string)

El nombre de la organización dueña del script que se está ejecutando

### Ejemplo 

<!-- tabs:start -->

#### **Node.JS**

```javascript
console.log(process.env.THEEYE_ORGANIZATION_NAME)
```

#### **Bash**

```bash
echo "$THEEYE_ORGANIZATION_NAME" 
```

#### **PowerShell**

```powershell
$env:THEEYE_ORGANIZATION_NAME 
```

#### **Python**

```python
import os

print(os.environ.get("THEEYE_ORGANIZATION_NAME"))
```

<!-- tabs:end -->

## Más ejemplos

###  Conseguir información del usuario mediante una tarea script de Windows (Batch)

Esta receta para tarea de script te muestra cómo conseguir el ID del usuario y su email. Puede usarse el mismo método para las variables `THEEYE_JOB` and `THEEYE_JOB_WORKFLOW`.

[Descargar Receta](https://raw.githubusercontent.com/theeye-io/theeye-docs/master/docs/assets/recipes/check_theeye_env_vars.json)
