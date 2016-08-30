# CHANGELOG

### 0.4.0 - 2016-08-28

> remove extra code an setters on task controller. pass input directly to the entity without filters      

> remove unused filters on routes      

> create resource/constants     

> add tag creation on resource monitors     

> remove duplicated mail handler and use one function with parameters     

> add logic to handle different type of events and send mail alerts      

> parse reported resource state as failure('error','fail','failure') or success('success','ok','normal') or not parsed        

> add to the scraper monitor extra options to create api requests and handle the response        

> remove monitor.setType , only use one type. monitor_type is deprecated      

> do not filter task template input , return all the request inputs, and validate as needed      

> added a simple test to validate resource-email-notifications generation       

> added route and methods for schedule cancellation      

### 0.3.2 - 2016-08-24

> removed schedule method from job controller        

> added method schedule and getSchedule to task controller       

> returned old functionality to task controller get method      

> added remote method to change resource alerts (on/off)      

### 0.3.1 - 2016-08-22

> task and monitors with tags     

> remove publish and create/parse methods. not necessary anymore and add complexity     

> task script run as when create task     

> update task execution email    

### 0.3.0 - 2016-08-19

> task and script data is registered in the job entity   

> moved script creation from controller to service     

> publish all the task data. use mongoose schema transform to remove _id and _v fields       

> remove job publish and static creation methods. the job populate all the data      

> remove unused baseschema         

> added task and script monitors 'run as'     

> remove custom script runner endpoint. only run scripts via tasks      

> task no longer has a resource property. make corrections on the schema     

> job payload changed. agent was adapted to the new response     

> remove monitor patch method (patch was doing nothing). only full update allowed       

> improve monitors and resources initialization. remove duplicated code     

> add validations in the monitors controller , when create       

> task controller create method improved      

### 0.2.0 - 2016-08-03

> improve scheduler initialization and code usage.

> improve job endpoints, handling and reponses. add email notification when job is completed.

> update localdev config

> remove mail notifications when dstat or psaux stop sending updates.

> fix bug in monitoring. the monitoring service was updating the monitor check counter to a fixed number.

> add information to dstat failure mail notifications

### 0.1.0 - 2016-07-29

> added CHANGELOG.md

> minor bug fixing (delete of tasks & scripts not working)
