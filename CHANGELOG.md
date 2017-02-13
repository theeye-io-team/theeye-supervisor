# CHANGELOG

### 0.8.0 - 2017-02-13    

> file monitor added     
> change api Host response payload     
> change route to update resources state

use a custom route to update resources state and trigger events

`PATCH /:customer/resource/:id/state`

this will update the resource state.
this route will be only available to agent users


### 0.7.0 - 2016-12-04      

> every route with security
>> added customer validation       
>> added credentiales validation       
>> added security access level       
>> added access control via credentials       
>> added restrictions to modify resources       
>> users are allowed to view by default       


> validate viewer, user, admin, owner, root credentials       
> improve filtering and querying data on some routes (code improved) and query via querystring       
> standarize some routes response            
> add some fixes and improvements in routes and source     
> added end ejecution of script by killing the process. log and register     
> unify the information that is being sent to elasticsearch      
> send full resource and monitor information via SNS to socket     
> always accept resource status update (assuming failure)       
> added remote method to get customer information      
> create monitors with acl's       

### 0.6.4 - 2016-11-03

> clean code       
> force to add last_update when handling resource state update     
> add ._id when query events by customer (which is a ObjectId reference)        
> added secret word in the url to cancel task scheduls via email        
> created a randomeSecret method to use . return a random sha256 string (used in webhooks, events & tasks)       
> added more options to mongo native driver via config           
> moved events.user config key to system.user           
> refactor monitor logic. now seems to be working better        
> fix scheduler service creation return callback, created job was removed from callback      
> add deploy script for tasks , events and monitors
> elastic search config is set via customer.config in database. set global config by default if not provided       
> general bug fixing          
> scheduler refactor , add tags to scheduled tasks             

### 0.6.3 - 2016-10-18

> workflow controller         
> workflow lib . create a workflow from current events & task attached triggers       
> workflow schemas . some schemas to persiste workflows in the feature . there are still not in use , because of the complexity to maintain the workflow       
> scheduler controller       
> change controllers initialization. trying to improve code to build with browserify (further improvements required)         
> some minor bug fixing

### 0.6.2 - 2016-10-13

> monitor result stored in ElasticSearch      
> change logger headers output from eye: > theeye:log:  (define new log levels : log, error, data , debug )         
> remove console.log       
> remove migration controller ( deprecated )        
> change webhook response code from 202 to 200       
> added controller workflow controller      
> replace some debug with logger calls     
> declare requires for each controller file found (instead of directory walk and dynamic requires )      
> remove unused route.validation calls and file , replace with node-validator                 
> added bundle & compilation tools (unglify2 , browserify , babel)            
> improve code syntax and compatibility       

### 0.6.1 - no deploy. only tag.

> added process monitor schema property is_regexp & raw_search (unescaped search pattern)       

### 0.6.0 - 2016-10-06

> separate task & task scheduler in different controllers       
> add user-customer route validation : requesting user and organization/customer param validation     
> added webhook controller       
> improve routes definition legibility      
> add "required" option to idToEntity resolver middleware       
> added webhook entity , and webhook events       
> added webhook trigger remote method and trigger with secret        
> send jobs result mail to every customer     
> beautify lib/elasticsearch code      

### 0.5.1 - 2016-09-26

> monitoring via agenda/scheduler            
> allow to cancel automatic tasks via email     

### 0.5.0 - 2016-09-21

> add a ref to Host in tasks and monitors schemas        
> events can now be attached to tasks        
> new schemas for event default, task , monitor & webhook      
> create default events 'success' & 'failure' for task & monitor entities       
> remove events when task & monitor are removed       
> created event remote method to retrieve available events       
> created trigger remote method , to emit events          
> improve script entity update     
> all input is passed directly to the entity        
> update filename with name        
> resources fetch return an array of resources , removed keyword "resources" from response           
> added query method strategy when fetch resources            
> change Event schema definition, base schema class created. use native mongoose without mongoose-schema-extend module        
> use same process to create task from user input and from template         
> added events dispatcher service (event > task)     
> moved lib/scheduler to service/scheduler            
> dispatcher initialize on supervisor startup        

### 0.4.0 - 2016-09-08

> task script, scraper and templated separated schemas logic     
> task schema is generic task (not instanciable yet)      
> job script , scraper and generic created      
> job test      
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
> validate external host id       
> rename scraper config properties names, remove subdocument structure       
> validate description & name in monitor creation      
> added mocha test as dev-dependency     
> event controller removed          

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
