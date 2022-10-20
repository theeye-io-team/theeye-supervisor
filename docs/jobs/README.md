[![theeye.io](../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# API de Jobs

-----

## Propiedades del modelo

  | Nombre de la propiedad | Tipo   | Default | Descripción                             | 
  | ---------------------- | ------ | ------- | --------------------------------------- | 
  | name                   | string |         | El nombre de la task                    | 
  | state                  | string |         | El estado del reslultado del job        | 
  | lifecycle              | string |         | El estado de ejecución del job          | 
  | task_arguments_values  | array  |         | Los argumentos de ejecución de la tarea | 

-----

## API Paths

### V1 

Reemplace la palabra clave `${customer}` con el nombre de su organización

`https://supervisor.theeye.io/${customer}/job?access_token=${token}`

  | Método | Dirección                        | Descripción                              | ACL    |
  | ------ | -------------------------------- | ---------------------------------------- | ------ |
  | GET    | /${customer}/job                 | [Lista de jobs](#ejemplo-2)              | viewer |
  | GET    | /${customer}/job/${id}           | [Buscar job por su ID](#ejemplo-1)       | viewer |
  | PUT    | /${customer}/job/${id}           | Marcar un job como finalizado            | agent  |
  | POST   | /${customer}/job                 | Crear un nuevo job (ejecutar tarea)      | user   |
  | GET    | /${customer}/job/${id}/lifecycle | [Buscar el estado de un job](#ejemplo-3) | user   |
  | PUT    | /${customer}/job/${id}/cancel    | [Cancelar un job](#ejemplo-4)            | user   |

### V2

`https://supervisor.theeye.io/job?access_token={token}&customer={organization_name}`

  | Método | Dirección           | Descripción                                                | ACL     | 
  | ------ | ------------------- | ---------------------------------------------------------- | ------- |
  | POST   | /job                | Crear un job                                               | user    |
  | GET    | /job/running        | [Listar todos los jobs que están en ejecución](#ejemplo-9) | user    |
  | GET    | /job/running_count  | [Cantidad de jobs que están en ejecución](#ejemplo-10)     | user    |
  | POST   | /job/secret/:secret | [Crear un job con la clave secreta](#ejemplo-5)            | anónimo |
  | DELETE | /job/finished       | [Eliminar el historial de jobs completados](#ejemplo-6)    | admin   |
  | PUT    | /job/${id}/approve  | [Aprovar un job de aprobación](#ejemplo-7)                 | viewer  |
  | PUT    | /job/${id}/reject   | [Rechazar un job de aprobación](#ejemplo-8)                | viewer  |
  | PUT    | /job/${id}/input    | Completar los inputs del job de una tarea                  | user    |


-----

## Ejemplos de Fetch

Utilizando el método HTTP GET sobre el endpoint de fetch de jobs permite obtener la infomación de todos los jobs existentes de una organización.

Los endpoints para fetch permiten hacer consultas aplicando filtros.
Los parámetros admitidos son los siguientes

  | Nombre   | Detalles                                                                                       | 
  | -----    | -----                                                                                          | 
  | where    | El filtro básico que permite obtener jobs utilizando cualquiera de las propiedades del modelo  | 
  | include  | Aplica filtros sobre el resultado del where para devolver los valores solicitados              | 
  | sort     | Ordenamiento                                                                                   | 
  | limit    | Cantidad máxima de valores devueltos                                                           | 
  | skip     | Filtra los primeros "skip" elementos del resultado                                             | 
  | populate | Obtiene documentos relacionados                                                                | 


### Jobs donde el primer argumento es igual a un JSON particular

  ```
  /job?where[task_arguments_values.0]={"comando":"MES_ACTUAL"}

  ```



-----

## Ejemplos

### **Ejemplo 1**

#### Buscar job por su ID

```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
id=$1

curl -sS --request GET "https://supervisor.theeye.io/${customer}/job/${id}?access_token=${token}"
```


### **Ejemplo 2**
#### Lista de jobs
```bash
access_token=$THEEYE_ACCESS_TOKEN
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
task_id=$1

echo "using: $customer"

curl -sS "https://supervisor.theeye.io/${customer}/job?access_token=${access_token}&where\[task_id\]=${task_id}&include\[state\]=1&include\[creation_date\]=1&include\[lifecycle\]=1"
```

### **Ejemplo 3**
#### Buscar el estado de un job
```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
id=$1

curl -sS --request GET "https://supervisor.theeye.io/${customer}/job/${id}/lifecycle?access_token=${token}"
```

### **Ejemplo 4**
#### Cancelar un job

```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
id=$1

curl -sS --request PUT "https://supervisor.theeye.io/${customer}/job/${id}/cancel?access_token=${token}"
```


### **Ejemplo 5**
#### Crear un job con la clave secreta

```bash
task="$1"
secret="$2"
customer=$(echo ${THEEYE_ORGANIZATION_NAME} | jq -r '.')

curl -i -sS -X POST "https://supervisor.theeye.io/job/secret/${secret}" \
  --header 'Content-Type: application/json' \
  --data '{"customer":"'${customer}'","task":"'${task}'","task_arguments":["'${PDF}'","'${Imagen}'","'${Link a XLS}'","'${Link Web}'","'${Una página externa}'"]}'
```


### **Ejemplo 6**
#### Delete completed jobs history

```bash
access_token=$THEEYE_ACCESS_TOKEN
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
task_id=$1

echo "using: $customer"

curl -sS  --request DELETE "https://supervisor.theeye.io/${customer}/job?access_token=${access_token}&where\[task_id\]=${task_id}"
```


### **Ejemplo 7**
#### Approve Approval job

```bash
customer=$(echo ${THEEYE_ORGANIZATION_NAME} | jq -r '.')
token="${THEEYE_ACCESS_TOKEN}"
id="$1"

curl -X PUT "https://supervisor.theeye.io/${customer}/job/${id}/approve?access_token=${token}"
```



### **Ejemplo 8**
#### Reject Approval job

```bash
customer=$(echo ${THEEYE_ORGANIZATION_NAME} | jq -r '.')
token="${THEEYE_ACCESS_TOKEN}"
id="$1"

curl -X PUT "https://supervisor.theeye.io/${customer}/job/${id}/reject?access_token=${token}"
```

### **Ejemplo 9**
#### Listar todos los jobs que están en ejecución

```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN

curl -sS --request GET "https://supervisor.theeye.io/${customer}//job/running?access_token=${token}"
```

### **Ejemplo 10**
#### Cantidad de jobs que están en ejecución

```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN

curl -sS --request GET "https://supervisor.theeye.io/${customer}//job/running_count?access_token=${token}"
```

-----

## Sample API Usage

NodeJS Api helper: <a target="_black" href="https://github.com/theeye-io/recipes/tree/master/api/jobs">Fetch and Cancel jobs using TheEye API</a>

