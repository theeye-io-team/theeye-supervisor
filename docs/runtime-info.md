[![theeye.io](images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Información de Runtime

Durante runtime, se puede consultar información del job que se está ejecutando mediante variables de entorno.

Toda la información está guardada en strings o estructuras JSON, y puede consultarla mediante las variables de entorno del runtime de TheEye. Las mismas son fácil de identificar ya que empiezan con el prefijo `THEEYE_`.

## `THEEYE_JOB` (objeto)

Contiene la información del job que se está ejecutando.

| Nombre  | Tipo   | Descripción                                                               |
| ------- | ------ | ------------------------------------------------------------------------- |
| id      | string | El ID del job. Se puede usar para consultar a la API                      |
| task_id | string | El ID de la task que generó el job. Se puede usar para consultar a la API |

## `THEEYE_JOB_USER` (objeto)

Este es el usuario que ejecutó la task y creó el job. Esta variable va a contener distintos parámetros dependiendo de cómo se haya ejecutado

* **Ejecución automática:** El usuario va a ser siempre un bot interno.
* **Botón Play:** El usuario va a ser quien que haya ejecutado la tarea desde la interfaz web.
* **Llamada a la API:** Las llamadas a la API pueden hacerse con *Integration Keys* (el usuario sería un bot) o con *Access Tokens* (el usuario sería humano).

| Nombre | Tipo   | Descripción       |
| ------ | ------ | ----------------- |
| id     | string | ID del usuario    |
| email  | string | Email del usuario |

## `THEEYE_JOB_WORKFLOW` (objeto)

Cuando las tareas son parte de un Workflow, esta variable contendrá información del mismo.

| Nombre  | Tipo   | Descripción                       |
| ------- | ------ | --------------------------------- |
| id      | string | Schema ID del workflow            |
| job_id  | string | La instancia de ejecución del job |

## `THEEYE_API_URL` (string)

La URL de la API por defecto

## `THEEYE_ORGANIZATION_NAME` (string)

El nombre de la organización dueña del script que se está ejecutando

## Ejemplos

###  Conseguir información del usuario mediante un script de Windows (BAT)

Este script te muestra cómo conseguir el ID del usuario y su email. Puede usarse el mismo método para las variables `THEEYE_JOB` and `THEEYE_JOB_WORKFLOW`.

[Descargar Receta](https://raw.githubusercontent.com/theeye-io/theeye-docs/master/docs/assets/recipes/check_theeye_env_vars.json)
