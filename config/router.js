
module.exports = {
  TheEye : {
    controllers : [
      { name:'psaux' },
      { name:'dstat' },
      { name:'agent' },
      {
        name:'agent-config',
        options : {
          route : '/agent/config/:hostname',
          middleware: [
            "matchRouteHost",
            "hostRequired"
          ]
        }
      },
      {
        name:'host',
        options : {
          authenticate : false,
          middleware: [
            "matchRouteCustomer",
            "customerRequired"
          ]
        }
      },
      { 
        name:'event',
        options : {
          middleware : [
            "matchRouteCustomer",
            "customerRequired",
            "matchRouteResourceId",
            "resourceRequired",
            "matchRouteHost",
            "hostRequired"
          ]
        }
      },
      { 
        name:'script',
        options : {
          authenticate : false,
          route : '/:customer/script',
          middleware : [
            "matchRouteCustomer",
            "customerRequired",
            "matchRouteUser"
          ]
        }
      },
      { 
        name:'script-download',
        options : {
          authenticate : false,
          route : '/:customer/script/download',
          middleware : [
            "matchRouteCustomer",
            "customerRequired"
          ]
        }
      },
      {
        name:'task',
        options : {
          authenticate : false,
          route : '/:customer/task',
          middleware : [
            "matchRouteCustomer",
            "customerRequired",
            "matchRouteHost",
            "matchRouteResourceId",
            "matchRouteUser"
          ]
        }
      },
      {
        name:'resource-type',
        options : {
          authenticate : false,
          route : '/resource/type',
          middleware : [
          ]
        }
      },
      {
        name:'resource',
        options : {
          authenticate : false,
          route : '/resource',
          middleware : [
            "matchRouteCustomer",
            "matchRouteHost"
          ]
        }
      },
      {
        name:'job',
        options : {
          authenticate : false,
          route : '/:customer/job',
          middleware : [
            "matchRouteCustomer",
            "customerRequired",
            "matchRouteHost",
            "matchRouteUser"
          ]
        }
      },
      {
        name:'token',
        options : {
          middleware: [ ]
        }
      }
    ],
    controllersPath : './controllers/'
  }
};
