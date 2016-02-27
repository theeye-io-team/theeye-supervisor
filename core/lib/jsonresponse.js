

var success = function(msg,data){
    if(!data) data = {};
    if(!msg) msg = "undefined";

    return {
        status : "success",
        message : msg,
        data : data
    };
};

var error = function(msg,data){
    if(!data) data = {};
    if(!msg) msg = "undefined";

    return {
        status : "error",
        message : msg,
        data : data
    };
};

exports.success = success;
exports.error = error;
