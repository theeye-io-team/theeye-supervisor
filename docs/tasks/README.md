[![theeye.io](../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/en/index.html)

# Tasks API

____

## API Paths

| Method | Path                                                  | Description                         | ACL       | 
| -----  | -----                                                 | -----                               | -----     | 
| GET    | /${customer}/task                                     | [List all](#example-1)              | viewer    | 
|        |                                                       | [List and timeout](#example-3)      | viewer    | 
| GET    | /${customer}/task/${id}                               | [Get by id](#example-2)   | viewer    | 
| DELETE | /${customer}/task/${id}                               | Remove task                         | admin     | 
| GET    | /${customer}/task/:task/recipe                        | Get task recipe                     | admin     | 
| GET    | /${customer}/task/import                              | Create from recipe                  | admin     | 
| GET    | /${customer}/task/:task/credentials                   | Get task secret                     | admin     | 
| POST   | /${customer}/task/${id}/job                           | Run task                            | user      | 
| POST   | /${customer}/task/${id}/secret/${task_secret_key}/job | [Using task secret key](#example-4) | anonymous | 
| DELETE | /${customer}/task/${id}/job                           | Empty jobs queue                    | admin     | 

### NOTES

* _customer_ (REQUIRED)

    Can be included in the body as "customer"  

* _access_token_ (REQUIRED)

    Can be provided vía Authorization header \( Authorization: Bearer ${token} \)

-----


## Model Properties

| Property Name   | UI Name              | Type          | Default | Description                                                                                                                                                                                                                                                                                                                                                | 
| -----           | -----                | -----         |         | -----                                                                                                                                                                                                                                                                                                                                                      | 
| name            | Name                 | string        |         | name your task                                                                                                                                                                                                                                                                                                                                             | 
| host_id         | Bots                 | string        |         | select the host where the script will run                                                                                                                                                                                                                                                                                                                  | 
| script_id       | Script               | string        |         | select the script to be executed by the task                                                                                                                                                                                                                                                                                                               | 
| tags            | Tags                 | strings array |         | tag your task so you can find quickly through the application.                                                                                                                                                                                                                                                                                             | 
| task_arguments  | Task Arguments       | array         |         | If the script played by the task is meant to receive parameters you can set them from here. Mind the order as it will be used by the script. _Fixed_, _options_, and _input_ arguments are allowed. _Input_ and _options_ arguments will be asked to the user for execution. _Fixed_ arguments will not be displayed to the user at execution time.        | 
| run_as          | Run As               | string        |         | write down any extra command or argument needed to run the script. Windows users must declare here which interpreter to use. Linux users could prepend sudo                                                                                                                                                                                                | 
| description     | Description          | text          |         | describe your task. What does it do, what's the expected output after execution                                                                                                                                                                                                                                                                            | 
| acls            | ACL's                | array         |         | select who can view your task \(what can be done with the task depends on the user role\)                                                                                                                                                                                                                                                                  | 
| triggers        | Triggered by         | array         |         | If the task is part of a workflow, select what triggers the task. The task will be triggered by the resource you selected here.                                                                                                                                                                                                                            | 
| grace_time      | Trigger on-hold time | number        |         | enter the time period TheEye should wait before running the task. _No wait / Cancelation_ can be selected which means the task will run inmediately after triggered. \(only applicable for triggered tasks\). **To cancel the task execution during the grace period, go to tasks panel, expand the task and delete the schedule created by the trigger.** | 
| timeout         | Execution Timeout    | number        | 600     | This is the number of seconds the Bot will wait for the script to complete the execution. If the timeout is exceeded the Bot will try to terminate(kill) the script, sending SIGTERM/SIGKILL signal                                                                                                                                                        | 
| multitasking    | Multitasking         | boolean       |         | enable or disable parallel execution of the task. When this is enable assigned bot will be able to run multiple instances of the Job at same time. this is important to check when running DesktopBots                                                                                                                                                     | 
| env             | Environment (env)    | string        |         | Define extra environment variables that will be present during script execution                                                                                                                                                                                                                                                                            | 

### NOTES

*  _timeout_

    The default execution timeout for tasks is 10 minutes.
    
    Now it's not possible to change the timeout via API.

    To modify the timeout for a task use the Web Interface.

-----

## Running tasks

For a **Task** to run, internally, a new **Job** is created and added to the queue. If you want to run a **task** you only need to create a **Job** manually and supply the task ID \(and task options\) you want to run.

Note that in this example we are executing a task with no arguments, task_arguments is an empty array.
To execute a task with arguments, provide the list of ordered arguments in the "task_arguments" parameter.
Each argument must be a valid JSON escaped string.

This is easily done with a POST request to the Job endpoint API.

There are two methods available.

### Task and Workflow execution payload via API

When creating Task Jobs via API you will have to provide the Task ID and the Task Arguments.

```javascript
{
  // (required)
  task: "task id",
  // (required only if task has arguments)
  task_arguments: []
}
```

### Using task secret key. Integration Feature \(recommended\)

All tasks and workflows have a **secret key** which can be used to invoke them directly via API.
The secret key provides access to the task it belongs **and only to that task**.
**Secret keys** can be revoked any time by just changing them, which makes this the preferred method for it's implicity and security.

-----

## Examples


### **Example 1**
### Get all

*Resquest*

```bash
customer=$THEEYE_ORGANIZATION_NAME

curl -sS "https://supervisor.theeye.io/${customer}/task?access_token=$THEEYE_TOKEN"
```

### **Example 2**
### Get by id

*Request*

```bash
customer=$THEEYE_ORGANIZATION_NAME
task_id=$(echo $THEEYE_JOB | jq -r '.task_id')
echo "task id: ${task_id}"

result=$(curl -sS "https://supervisor.theeye.io/${customer}/task/${task_id}?access_token=${THEEYE_TOKEN}")

echo $result | jq -c '. | {"name": .name, "id": .id, "hostname": .hostname}'
```

*Response*

Returns a json array with tasks, id and hostname:
```json
[
  {
    "name": "Get IP Address",
    "id": "5b1c65ee3c32bb1100c2920a",
    "hostname": "Apache3"
  },
  {
    "name": "Get IP Address",
    "id": "5b1c65ee3c32bb1100c29210",
    "hostname": "Apache1"
  },
  {
    "name": "Get IP Address",
    "id": "5b1c65efd421031000213bb8",
    "hostname": "Apache4"
  },
  {
    "name": "Get IP Address",
    "id": "5b1c65efd421031000213bc6",
    "hostname": "Apache2"
  }
]
```

### **Example 3**
### List and timeout

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
