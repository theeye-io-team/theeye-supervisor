
module.exports = {
    "dstat" : {
        type     : 'dstat',
        name     : 'dstat',
        looptime : 40000
    },
    "listener" : {
        type       : 'listener',
        name       : 'listener',
        looptime   : 30000
    },
    "scraper" : {
        type       : 'scraper',
        name       : 'scraper',
        looptime   : 30000,
        service_id : null ,
        pattern    : null ,
        request_options : { // parameters for requestjs library
            url     : null , // the url to query for. required parameter
            timeout : '5000' , // default milliseconds
            method  : 'get' , // default method
            headers : {}
        }       
    },
    "service" : {
        type       : 'service',
        name       : 'service',
        looptime   : 30000,
        service_id : null
    }
};
