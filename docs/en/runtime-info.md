[![theeye.io](../../images/logo-theeye-theOeye-logo2.png)](https://theeye.io/index.html)

# Runtime Information

During runtime, you can access basic information of the job being executed via environment variables.

The information is storead as JSON Strings or as JSON encoded Key-Value structures.
All the environment variables belonging to TheEye runtime are prefixed with *THEEYE_* keyword

## `THEEYE_JOB` (object)

Contains information of the current job.

| Name | Type | Description |
| ---  | --- | --- |
| id | string | the id of the job. you can fetch the API with it |
| task_id | string | task definition id. can fetch the API with it |

### Example 

<!-- tabs:start -->

#### **Bash**

To analyze a JSON object string we'll be using the `jq` package. [Learn more](https://stedolan.github.io/jq/)

```bash
echo "$THEEYE_JOB" || jq .
```

#### **PowerShell**

```powershell
$env:THEEYE_JOB | convertfrom-json | convertto-json -depth 100 | Write-Host
```

#### **Node.JS**

```javascript
console.log(JSON.parse(process.env.THEEYE_JOB))
```

#### **Python**

```python
import os
import json

print(json.loads(os.environ.get("THEEYE_JOB")))
```

<!-- tabs:end -->

## `THEEYE_JOB_USER` (object)

This is the user that executes the Task. This env will contain different values depending on how the task was executed.

* Automatic Execution: the user will be always a internal bot user.
* Play Button: When the task is executed via User Interface. This will be the user that pushed the Play Button.
* API Calls: Api calls can be done using Integration Keys (bot user) or Access Tokens (human user). The user would be a bot or a human.

| Name | Type | Description |
| ---  | --- | --- |
| id | string | the user id |
| email | string | the user email |

### Example 

<!-- tabs:start -->

#### **Bash**

To analyze a JSON object string we'll be using the `jq` package. [Learn more](https://stedolan.github.io/jq/)

```bash
echo "$THEEYE_JOB_USER" || jq .
```

#### **PowerShell**

```powershell
$env:THEEYE_JOB_USER | convertfrom-json | convertto-json -depth 100 | Write-Host
```

#### **Node.JS**

```javascript
console.log(JSON.parse(process.env.THEEYE_JOB_USER))
```

#### **Python**

```python
import os
import json

print(json.loads(os.environ.get("THEEYE_JOB_USER")))
```

<!-- tabs:end -->

## `THEEYE_JOB_WORKFLOW` (object)

When Tasks belongs to Workflows, this constains information of the Workflow.

| Name | Type | Description |
| ---  | --- | --- |
| id | string | the workflow schema id |
| job_id | string | the workflow job execution instance |

### Ejemplo 

<!-- tabs:start -->

#### **Bash**

To analyze a JSON object string we'll be using the `jq` package. [Learn more](https://stedolan.github.io/jq/)

```bash
echo "$THEEYE_JOB_WORKFLOW" || jq .
```

#### **PowerShell**

```powershell
$env:THEEYE_JOB_WORKFLOW | convertfrom-json | convertto-json -depth 100 | Write-Host
```

#### **Node.JS**

```javascript
console.log(JSON.parse(process.env.THEEYE_JOB_WORKFLOW))
```

#### **Python**

```python
import os
import json

print(json.loads(os.environ.get("THEEYE_JOB_WORKFLOW")))
```

<!-- tabs:end -->

## `THEEYE_API_URL` (string)

This is the default API URL.

### Example 

<!-- tabs:start -->

#### **Bash**

```bash
echo "$THEEYE_API_URL" 
```

#### **PowerShell**

```powershell
$env:THEEYE_API_URL 
```

#### **Node.JS**

```javascript
console.log(process.env.THEEYE_API_URL)
```

#### **Python**

```python
import os

print(os.environ.get("THEEYE_API_URL"))
```

<!-- tabs:end -->

## `THEEYE_ORGANIZATION_NAME` (string)

This is the organization name or project running the current script.

### Example 

<!-- tabs:start -->

#### **Bash**

```bash
echo "$THEEYE_ORGANIZATION_NAME" 
```

#### **PowerShell**

```powershell
$env:THEEYE_ORGANIZATION_NAME 
```

#### **Node.JS**

```javascript
console.log(process.env.THEEYE_ORGANIZATION_NAME)
```

#### **Python**

```python
import os

print(os.environ.get("THEEYE_ORGANIZATION_NAME"))
```

<!-- tabs:end -->

## More examples

###  Get user information from a Windows Batch script task

The following script task recipe shows how to get user id and email information, it can be replicated to get information for THEEYE_JOB and THEEYE_JOB_WORKFLOW:
[Download Recipe](https://github.com/theeye-io/theeye-docs/blob/master/docs/assets/recipes/check_theeye_env_vars.json)

