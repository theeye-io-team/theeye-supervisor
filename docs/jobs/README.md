[![theeye.io](../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Jobs API

-----

## Model Properties

    | Property Name         | Type   | Default | Description | 
    | -----                 | -----  |         | -----       | 
    | name                  | string |         |             | 
    | state                 | string |         |             | 
    | lifecycle             | string |         |             | 
    | task_arguments_values | array |         |             | 
    |                       |        |         |             | 

-----

## API Paths

### V1 

Replace the `${customer}` keyword with your organization name

`https://supervisor.theeye.io/${customer}/job?access_token=${token}`

 | Method | Path                             | Description                           | ACL    | 
 | -----  | -----                            | -----                                 | -----  | 
 | GET    | /${customer}/job                 | Fetch [Get all jobs](#example-2)            | viewer | 
 | GET    | /${customer}/job/${id}           | [Get job by id](#example-1)           | viewer | 
 | PUT    | /${customer}/job/${id}           | Finish a job, update execution status | \*agent | 
 | POST   | /${customer}/job                 | Create a new job instance             | user   |
 | GET    | /${customer}/job/${id}/lifecycle | [Get job lifecycle](#example-3)       | user   | 
 | PUT    | /${customer}/job/${id}/cancel    | [Cancel job](#example-4)              | user   | 

### V2

`https://supervisor.theeye.io/job?access_token={token}&customer={organization_name}`

  | Method | Path                | Description                                 | ACL       |
  | -----  | -----               | -----                                       | -----     |
  | POST   | /job                | [Creates a job](#example-5)                 | user      |
  | POST   | /job/secret/:secret | [Creates a job using the secret key](#example-9) | anonymous |
  | DELETE | /job/finished       | [Delete completed jobs history](#example-6) | admin     |
  | PUT    | /job/${id}/approve  | [Approve Approval job](#example-7)          | viewer    |
  | PUT    | /job/${id}/reject   | [Reject Approval job](#example-8)           | viewer    |
  | PUT    | /job/${id}/input    | Submit script job input                     | user      |


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

## EXAMPLES

#### **Example 1**

##### Get job by id

```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
id=$1

curl -sS --request GET "https://supervisor.theeye.io/${customer}/job/${id}?access_token=${token}"
```


#### **Example 2**
##### Get all jobs of specific task
```bash
access_token=$THEEYE_ACCESS_TOKEN
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
task_id=$1

echo "using: $customer"

curl -sS "https://supervisor.theeye.io/${customer}/job?access_token=${access_token}&where\[task_id\]=${task_id}&include\[state\]=1&include\[creation_date\]=1&include\[lifecycle\]=1"
```

#### **Example 3**
#### Get job lifecycle
```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
id=$1

curl -sS --request GET "https://supervisor.theeye.io/${customer}/job/${id}/lifecycle?access_token=${token}"
```

#### **Example 4**
##### Cancel Job

```bash
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
token=$THEEYE_ACCESS_TOKEN
id=$1

curl -sS --request PUT "https://supervisor.theeye.io/${customer}/job/${id}/cancel?access_token=${token}"
```


### **Example 5**
### Create a job using the task secret key

```bash
task="$1"
secret="$2"
customer=$(echo ${THEEYE_ORGANIZATION_NAME} | jq -r '.')

curl -i -sS -X POST "https://supervisor.theeye.io/job/secret/${secret}" \
  --header 'Content-Type: application/json' \
  --data '{"customer":"'${customer}'","task":"'${task}'","task_arguments":["'${PDF}'","'${Imagen}'","'${Link a XLS}'","'${Link Web}'","'${Una página externa}'"]}'
```


### **Example 6**
### Delete completed jobs history

```bash
access_token=$THEEYE_ACCESS_TOKEN
customer=$(echo $THEEYE_ORGANIZATION_NAME | jq -r '.')
task_id=$1

echo "using: $customer"

curl -sS  --request DELETE "https://supervisor.theeye.io/${customer}/job?access_token=${access_token}&where\[task_id\]=${task_id}"
```


#### **Example 7**
##### Approve Approval job

```bash
customer=$(echo ${THEEYE_ORGANIZATION_NAME} | jq -r '.')
token="${THEEYE_ACCESS_TOKEN}"
id="$1"

curl -X PUT "https://supervisor.theeye.io/${customer}/job/${id}/approve?access_token=${token}"
```



#### **Example 8**
##### Reject Approval job

```bash
customer=$(echo ${THEEYE_ORGANIZATION_NAME} | jq -r '.')
token="${THEEYE_ACCESS_TOKEN}"
id="$1"

curl -X PUT "https://supervisor.theeye.io/${customer}/job/${id}/reject?access_token=${token}"
```

-----

### Sample API Usage

NodeJS Api helper: <a target="_black" href="https://github.com/theeye-io/recipes/tree/master/api/jobs">Fetch and Cancel jobs using TheEye API</a>

