
var debug = require('debug')('eye:supervisor:setup:importer');
var crypto = require('crypto');

var Customer = require( process.env.BASE_PATH + 'entity/customer' ).Entity;
var User     = require( process.env.BASE_PATH + 'entity/user' ).Entity;
var Resource = require( process.env.BASE_PATH + 'entity/resource' ).Entity;
var Host     = require( process.env.BASE_PATH + 'entity/host' ).Entity;
var Category = require( process.env.BASE_PATH + 'entity/serviceCategory' ).Entity;


var _ = require('underscore');
var fs = require('fs');

var ConnectionTemplate = require( process.env.BASE_PATH + 'model/importer/connection.tpl.js');
var WorkersTemplates   = require( process.env.BASE_PATH + 'model/importer/workers.tpl.js');

function register_service_category_service(config, next)
{
    /**
    debug("registering service category "+ config.category_name.name);

    var eid = crypto
        .createHash('sha1')
        .update("category_name" + config.category_name.name)
        .digest('hex');

    debug(" category name external id " + eid );

    var category = new category({
        name : config.category_name.name ,
        external_id : eid,
    });

    category.save(function(){
    **/

    console.log(config);

        debug("registering service " + config.service.name);

        var eid = crypto
            .createHash('sha1')
            .update( 
                "service" + 
                config.customer.name + 
                config.service.type + 
                config.service.name + 
                config.host.hostname 
                )
            .digest('hex') ;

        debug(" service external id " + eid );

        var service = new Resource({
            //category_id      : category._id ,
            category_name    : config.service_category.name ,
            external_id    : eid ,
            customer_id    : config.customer._id ,
            customer_name  : config.customer.name ,
            host_id        : config.host._id ,
            hostname       : config.host.hostname ,
            type           : config.service.type ,
            name           : config.service.name ,
            description    : config.service.description ,
            status         : 'unknown' ,
            attend_failure : config.service.attend_failure  ,
            creation_date  : new Date()
        });

        service.save(function(){
            next(service);
        });

    //});
};

function register_host(config, next)
{
    debug("registering host "+ config.hostname);

    var eid = crypto
        .createHash('sha1')
        .update(
            "host" + 
            config.os_family + 
            config.hostname + 
            config.os_version
            )
        .digest('hex') ;

    debug("host external id" + eid);

    var host = new Host({
        "external_id"   : eid ,
        "customer_name" : config.customer.name ,
        "customer_id"   : config.customer._id ,
        "hostname"      : config.hostname ,
        "ip"            : config.ip ,
        "creation_date" : new Date() ,
        "os_name"       : config.os_family ,
        "os_version"    : config.os_version ,
        "status"        : config.status
    });
    host.save(function(){
        next(host);
    });
};

function register_user(config, next)
{
    debug("registering user " + config.name);

    var eid =  crypto
        .createHash('sha1')
        .update( 
            "user" + 
            config.client_id + 
            config.client_secret 
            )
        .digest('hex') ;

    debug(" user external id " + eid );

    var user = new User({
        external_id   : eid,
        customer_name : config.customer.name,
        customer_id   : config.customer._id,
        client_id     : config.client_id,
        client_secret : config.client_secret,
        firstname     : config.name
    });
    user.save(function(){
        next(user);
    });
};

function register_customer(config, next)
{
    debug("registering customer "+ config.name);

        var eid =  crypto
            .createHash('sha1')
            .update("customer" + config.name)
            .digest('hex')  ;

        debug(" user external id " + eid );

    var customer = new Customer({
        name : config.name,
        description : config.description,
        email : config.email,
        external_id : eid ,
    });
    customer.save(function(){
        next(customer);
    });
};

function save_config(config, file, next)
{
    var data = JSON.stringify(config, null, 4);
    fs.writeFile(file, data, function (err) {
        if (err) {
            console.log('There has been an error saving the configuration data.');
            console.log(err.message);
            return;
        }
        debug('Configuration ' + file + ' saved successfully.')

        next();
    });
}

function generate_connection_config(options, next)
{
    var connection = _.clone( ConnectionTemplate );
    //connection.name          = options.user.name ;
    connection.client_id       = options.user.client_id ;
    connection.client_secret   = options.user.client_secret ;
    connection.customer_id     = options.customer.external_id ;
    connection.customer_name   = options.customer.name ;
    connection.host_id         = options.host.external_id ;

    // supervisor data
    connection.data_submit.url = options.data_url ;
    connection.auth.url        = options.auth_url ;
    connection.auth.controller   = connection.auth.controller.replace(/:customer/, options.customer.name) ;

    var data = {
        agent_name : options.user.client_id ,
        connection : connection
    } ;

    save_config( data, './configs/connection_' + options.customer.name + '_' + options.user.client_id + '.json' , function(){
        next();
    });
}

function generate_workers_config(options, workers, next)
{
    var data = [];

    for( var index in workers )
    {
        var config = workers[ index ] ;

        debug("Creating worker %s", config.type);
        var worker = _.clone( WorkersTemplates[ config.type ] );
        worker.name          = config.name;
        worker.looptime      = config.looptime;
        worker.customer_name = options.customer.name;
        worker.customer_id   = options.customer.external_id;

        switch(config.type)
        {
            case 'scraper':
                if( typeof config.request_options != 'undefined' )
                {
                    var opts = config.request_options ;
                    worker.request_options = _.clone(WorkersTemplates[ config.type ].request_options) ;
                    if(opts.url    ) worker.request_options.url     = opts.url; 
                    if(opts.method ) worker.request_options.method  = opts.method; 
                    if(opts.timeout) worker.request_options.timeout = opts.timeout;
                }

                worker.pattern = config.pattern ;
            case 'listener':
            case 'service':
                worker.service_id = config.service_id ;
                worker.ps = config.ps ;
                break;
            case 'dstat':
                break;
        }

        data.push( worker ) ;
    }

    var wd = {
        agent_name : options.user.client_id,
        workers : data
    } ;

    save_config( wd, './configs/worker_' + options.customer.name + '_' + options.user.client_id + '.json' , function(){
        next();
    });
}

module.exports = {
    register_customer       : register_customer ,
    register_user           : register_user ,
    register_host           : register_host ,
    register_service_category_service : register_service_category_service ,
    generate_connection_config : generate_connection_config ,
    generate_workers_config : generate_workers_config
}
