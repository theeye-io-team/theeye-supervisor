
function Trigger (options)
{
    this.host      = options.host ;
    this.service   = options.service ;
    this.action    = options.action ;
    this.category  = options.category ;
}

Trigger.prototype = {
};

module.exports = Trigger ;
