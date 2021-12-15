[![theeye.io](../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Sync API

## URL

**https://sync.theeye.io**


La ejecución de tareas en TheEye es asincrónica por naturaleza. Esto significa que la tarea se va a ejecutar en segundo plano y el tiempo que tarda en completar varía. En general, no necesitamos esperar el resultado ya que lo podemos revisar cuando esté disponible.

Pero hay casos que requieren que se ejecute la tarea y se espere al resultado. Este caso es común cuando se quiere conectar APIs o usar tareas que requieren interacción de usuario, entre otros escenarios. 

Esto puede hacerse usando la API en modo `sync`. la única limitación es el timeout de ejecución de la tarea. Se recomienda configurar el timeout alrededor de los 60 segundos. El comportamiento de los clientes se puede editar pero por experiencia recomendamos evitarlo de no ser estríctamente necesario... 

## API Paths

| Metoodo | Dirección                   | Descripción                 | ACL  | 
| ------- | --------------------------- | --------------------------- | ---- |
| POST    | /${customer}/task/${id}/job | [Run task](#esperar-por-el-output) | user | 


### NOTAS

* Solo hay soporte para ejecución de **Tareas**. La ejecución de Workflows **NO es posible** en este momento.

## Ejemplos

### Esperar por el output

```bash
customer=""
taskId=""
token=""

curl -s -X POST "https://sync.theeye.io/${customer}/task/${taskId}/job?access_token=${token}" | jq .output
```
