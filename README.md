# TheEye
**TheEye** is a **Servers Automation Platform made easier**

It's a tool that let you resolve infrastructure problems in a very simple way and from your phone. 

## Table of contents

* [Architecture](#markdown-header-architecture)
      * [Theeye system components](#markdown-header-components)
      * [Theeye overall structure](#markdown-header-structure)
* [Prerequisites](#markdown-header-prerequisites)
* [Setup](#markdown-header-setup)
* [Supervisor](#Supervisor-API-Documentation)

##Architecture
### Components

**TheEye** system is composed by: 

* **TheEye Supervisor** - The **Supervisor** is an API that receives events from **TheEye Agents** which are running within customers hosts/servers. The Supervisor also trigger events with different mechanisms, to those the clients can subscribe to receive the events information via email, via a web interface or with another custom integration.

* **TheEye Agent**. The **Agent** is the client running on the customers host. It gather data and information from the environment, send reports to the **TheEye Supervisor** and enables the Supervisor to send tasks to the servers in the form of scripts and commands.

* **TheEye Web Interface**. - The **Web Interface** is a web client. It allows users
to get access to resources status and graphical information about all the resources monitored by the Agents that are running on the customer's servers. It also allows the user to react to events by triggering tasks which are processed by the supervisor and executed via the Agents.

### Structure

      worker1 
    (checks dstat
    on a customer's
      server)
         â”‚
         â”œâ”€â”€â”€â”€ TheEye Agent â”€â”€â”€â”€â”€â”€â”€â”€ TheEye Supervisor â”€â”€â”€â”€ TheEye Web
         â”‚   (customer's host or external host)
         â”‚
      worker2 
    (scraps a 
     customer's
     service)

## Prerequisites

Install [Docker](https://www.docker.com/) on your system.

* [Install instructions](https://docs.docker.com/installation/mac/) for Mac OS X
* [Install instructions](https://docs.docker.com/installation/ubuntulinux/) for Ubuntu Linux
* [Install instructions](https://docs.docker.com/installation/) for other platforms

Install [Docker Compose](http://docs.docker.com/compose/) on your system.

* Python/pip: `sudo pip install -U docker-compose`
* Other: ``curl -L https://github.com/docker/compose/releases/download/1.6.0/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose; chmod +x /usr/local/bin/docker-compose``

[Login or register at dockerhub](https://docs.docker.com/engine/reference/commandline/login/)

## Setup
* 1- do a docker login
* 2- create theeye root directory where you'll work and then fech each piece:    
    * 2.a-supervisor   :    git clone git@bitbucket.org:interactar/supervisor.git     
    * 2.b-web interface:    git clone git@bitbucket.org:interactar/web.git      
    * 2.c-agent        :    git@github.com:interactar/theeye-agent.git      
* 3- download/ or clone https://gist.github.com/jailbirt/0523a8d4aab2e90bbf66     


## Start

1- Run `docker-compose up` that should start all the components whose are  agent,web,supervisor containers. 
The app should then be running on your docker daemon on port 6080 (On OS X you can use `boot2docker ip` to find out the IP address).

2- Optional, use dump for fullfill initial data, web user/pass are demo:12345678.
                We aim you to run:
                2.a cd misc/mongodb
                2.b tar -xvzf dump.tar.gz
                2.c mongorestore --db theeye ./dump/theeye

3- Congrats, you are ready brave man.

## Workarounds

For easier logs read you can run:
docker-compose up > /tmp/someArchive and then tail -f /tmp/someArchive | grep --line-buffered


## Supervisor-API-Documentation

> _NOTE1  "**:hostname**" part of all routes should be replaced with the registered hostname_   
> _NOTE2 dates are always YYYY-MM-DDTHH:mm:ss.sssZ ISO 8601. except otherwise specified.

______

### Scripts (authentication not required so far)


#### Get a Script

**method** : GET   
**service url** : /script/:id   
**response**   

```json
{  
  "script":{  
    "id":"555642d919908c232ea1f2f6",
    "filename":"startapache2.sh",
    "description":"start apache 2",
    "mimetype":"application/x-shellscript",
    "extension":"sh",
    "size":40
  }
}
```

#### Fetch Scripts

**method** : GET   
**service url** : /script   
**query parameters**    

* user : string  
 
**response**   

```json
{
  "scripts": [
  {
    "id": "5553a7454e8c93f919000001",
    "filename": "go.sh",
    "description": "This script uploads everything to a supernova, and waits until de black hole is achieved even when the AMI are not downloaded yet",
    "mimetype": "application/x-sh",
    "extension": "sh",
    "size": 25
  },
  {
    "id": "5554930b697b3a5a12000004",
    "filename": "go.sh",
    "description": "This script rocks",
    "mimetype": "application/x-sh",
    "extension": "sh",
    "size": 25
  }
  ]
}
```


#### Create a Script

**method** : POST   
**service url** : /script/   
**required _Content-Type_** : multipart/form-data   
**body parameters**   

* user : string   
* script : file    
* description : string   
   
**response**
```json
{  
  "script":{  
    "id":"555642d919908c232ea1f2f6",
    "filename":"startapache2.sh",
    "description":"start apache 2",
    "mimetype":"application/x-shellscript",
    "extension":"sh",
    "size":40
  }
}
```

#### Update a Script

**method** : PUT   
**service url** : /script/   
**required _Content-Type_** : multipart/form-data   
**form-data parameters**   

* description : string
* script : file

**sample request**

> _curl -F script=@/tmp/script_data.sh -F description="data fetch" -H "Content-Type: multipart/form-data" -X PUT http://localhost:60080/facugon/script/5567dcabe3dea6612e816e18_

**response**

```json
{  
  "script":{
    "id":"5567dcabe3dea6612e816e18",
    "filename":"script_data.sh",
    "description":"data fetch",
    "mimetype":"application/octet-stream",
    "extension":"sh",
    "size":48,
    "download":"http://localhost:60080/facugon/script/download/5567dcabe3dea6612e816e18"
  }
}
```



#### Delete a Script

**service url** /script/{id}    
**method :** DELETE    

**request**

> _curl -X DELETE http://localhost:60080/facugon/script/_


_____

### Scripts Download


#### Download a Script

**method** : GET   
**service url** : /script/download/:id   

**request**    

> _curl http://localhost:60080/facugon/script/download/5567dcabe3dea6612e816e18_

**response**   

```sh
#!/bin/bash

echo "demo"

pwd
ls -l

echo "end"
```

_____

### Tasks controller

#### Get a single Task

**service url** : /task/:id    

**request**    

> _curl "http://localhost:60080/facugon/task/555642f519908c232ea1f2f7"_    

**response**    


```json
{  
   "task":{  
      "id":"555642f519908c232ea1f2f7",
      "name":"start apache2",
      "description":"iniciar el servicio apache2",
      "host_id":"553e8deaeef6251b47000002",
      "script_id":"555642d919908c232ea1f2f6",
      "resource_id":"5525fb22539444d52a000006"
   }
}
```

#### Fetch Tasks

**service url** : /task/    
**method :** GET    
**query parameters**     

* user : string    
* hostname : string    

**request**

> _curl "http://localhost:60080/facugon/task?user=facugon&hostname=facundo-MOV"_    

**response**    

```json
{  
   "tasks":[  
      {  
         "id":"555642f519908c232ea1f2f7",
         "name":"start apache2",
         "description":"iniciar el servicio apache2",
         "host_id":"553e8deaeef6251b47000002",
         "script_id":"555642d919908c232ea1f2f6",
         "resource_id":"5525fb22539444d52a000006"
      },
      {  
         "id":"5556432019908c232ea1f2f9",
         "name":"stop apache2",
         "description":"detener el servicio apache2",
         "host_id":"553e8deaeef6251b47000002",
         "script_id":"5556430719908c232ea1f2f8",
         "resource_id":"5525fb22539444d52a000006"
      },
      {  
         "id":"5556438c19908c232ea1f2fb",
         "name":"stop mysql",
         "description":"detener el servicio mysql",
         "host_id":"553e8deaeef6251b47000002",
         "script_id":"5556435819908c232ea1f2fa",
         "resource_id":"5545278bfd26ecdc9f3a6dde"
      },
     ...
   ]
}
```

#### Create a Task

**service url** /task/    
**method :** POST    
**body parameters**    

* hostname : string    
* user : string    
* resource_id : string    
* script_id : string    
* description : string    
* name : string    

**response**

```json
{  
   "task":{  
      "id":"55569d5eb12f6e445af33bac",
      "name":"start mysql",
      "description":"init mysql server",
      "host_id":"553e8deaeef6251b47000002",
      "script_id":"5556439219908c232ea1f2fc",
      "resource_id":"5545278bfd26ecdc9f3a6dde"
   }
}
```

#### Update a Task

**service url** /task/{id}    
**method :** PUT    
**body parameters**    

* hostname : string    
* resource_id : string    
* script_id : string    
* description : string    
* name : string    

**sample request**

> _curl -d '{"description":"una tarea de prueba que no hace nada","name":"demo task","script_id":"5567dcabe3dea6612e816e18"}' -H "Content-Type: application/json" -X PUT http://localhost:60080/facugon/task/55689017704fd47c534b6b40_

**sample response**

```json
{  
   "task":{  
      "id":"55689017704fd47c534b6b40",
      "name":"demo task",
      "description":"una tarea de prueba que no hace nada",
      "host_id":"553e8deaeef6251b47000002",
      "script_id":"5567dcabe3dea6612e816e18",
      "customer_id":"5525fb22539444d52a000001",
      "resource_id":"5525fb22539444d52a000006"
   }
}
```

#### Delete a Task

**service url** /task/{id}    
**method :** DELETE    

**request**

> _curl -X DELETE http://localhost:60080/facugon/task/55689017704fd47c534b6b40_


____

### Job controller

**service url** : /job/:hostname/   




____

### Trigger Controller

#### Create a Trigger

**service url** /trigger    
**method** POST    
**body parameters**    

* event_name    
* resource_id    
* task_id    
* description    

**request**    
> curl -H "Content-Type: application/json" -X POST -d '{"event_name":"failure","resource_id":"5525fb22539444d52a000006","task_id":"555642f519908c232ea1f2f7","description":""}' "http://localhost:60080/facugon/trigger"

**response**
```json
{  
   "trigger":{  
      "id":"5556a290b12f6e445af33bad",
      "event_name":"failure",
      "resource_id":"5525fb22539444d52a000006",
      "description":"",
      "task_id":"555642f519908c232ea1f2f7"
   }
}
```

____

### Macro Controller

#### Run a new macro

**service url** /macro/:script_id/run    
**method** POST    
**required _Content-Type_** : multipart/form-data   
**body parameters**    

* String host id
* Array script_arguments

**sample request**
> curl -X POST http://url-del-ojo/macro/561d496044ea547f698a5a8e/run -H "Content-Type: multipart/form-data" -F "host=55fb014d64b918e82b165d41" -F "script_arguments=1" -F 'script_arguments="--exec=ble"' -F "username=facugon"

**sample response**
```json
{  
  "job":{
    "id":"56299b2ea0c5656a37860378",
    "task_id":null,
    "host_id":"55fb014d64b918e82b165d41",
    "user_id":"552616555f1e060dfe1a0403",
    "customer_id":"5525fb22539444d52a000001",
    "customer_name":"facugon",
    "name":"macro job",
    "notify":true,
    "state":"new",
    "result":{},
    "script_id":"561d496044ea547f698a5a8e",
    "script_md5":"de417292940ec3e17d9835dd8cdf2a65",
    "script_arguments":[
      "1",
      "\"--exec=ble\""
    ],
    "creation_date":"2015-10-23T02:35:15.289Z"
  }
}

```


### User Controller

**User entity definition**    

* token : {String}
* client_id : {String}
* client_secret : {String}
* email : {String}
* customers : {Array} a list of customer id's
* credential : {String}
* enabled : {Boolean}
* last_update : {Date} 
* creation_date : {Date}

#### Create

**service url** /user     
**method** POST    
**required _Content-Type_** : application/x-www-form-urlencoded   
**parameters interface**    

* client_id _(required)_
* client_secret _(required)_
* email _(required)_
* customers _(at least one required)_
* credential _(required)_
* enabled _(false by default)_

**sample request**

> curl -X POST 'http://localhost:60080/user?access_token=40d83302aece6184bfc026c74c3d5387232ea8ed&client_id=id&client_secret=bianca&email=elianam4@gmail.com&customers=5525fb22539444d52a000001&credential=admin' 


**sample response**

```
{
    "user": {
        "client_id": "id",
        "client_secret": null,
        "creation_date": "2015-11-10T17:29:55.921Z",
        "credential": "admin",
        "customers": [
            {
                "config": {},
                "creation_date": "2015-04-09T04:08:02.608Z",
                "emails": [
                    "facundo.siquot@gmail.com"
                ],
                "id": "5525fb22539444d52a000001",
                "name": "facugon"
            }
        ],
        "email": "elianam4@gmail.com",
        "enabled": false,
        "id": "5642299e31544dd949df3990",
        "last_update": "2015-11-10T17:29:55.921Z"
    }
}

```

#### Get

**service url** /user/:user_id     
**method** GET    
**required _Content-Type_** : not required

**sample request**

> curl 'http://localhost:60080/user/564221798853261441a4c6be?access_token=40d83302aece6184bfc026c74c3d5387232ea8ed'


**sample response**

```

{
    "user": {
        "client_id": "id",
        "client_secret": "",
        "creation_date": "2015-11-10T16:38:49.920Z",
        "credential": "admin",
        "customers": [
            {
                "config": {},
                "creation_date": "2015-04-09T04:08:02.608Z",
                "emails": [
                    "facundo.siquot@gmail.com"
                ],
                "id": "5525fb22539444d52a000001",
                "name": "facugon"
            }
        ],
        "email": "elianam4@gmail.com",
        "enabled": false,
        "id": "564221798853261441a4c6be",
        "last_update": "2015-11-10T16:38:49.000Z"
    }
}

```


### Customer Controller