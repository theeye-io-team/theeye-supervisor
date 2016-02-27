var ErrorHandler = module.exports = function(){
  var errors = [];

  function required(name){
    var e = new Error(name + ' is required');
    e.statusCode = 400;
    errors.push( e );
		return e;
  }

  function invalid(name,value){
    var e = new Error(name + ' is invalid');
    e.statusCode = 400;
    e.extras = value;
    errors.push( e );
		return e;
  }

  /**
   *
   * turn object into Array.
   * Array knows how turn it self into string
   *
   */
  function toString(){
    var e = [];
    for(var i=0; i<errors.length; i++){
      e.push({
        'message': errors[i].message, 
        'statusCode': errors[i].statusCode, 
        'extras': errors[i].extras 
      });
    }
    return e;
  }

  function hasErrors(){
    return errors.length > 0;
  }

  return {
    required: required,
    invalid: invalid,
    toString: toString,
    hasErrors: hasErrors
  }
}
