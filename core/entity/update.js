
module.exports = function(updates, next) {

  for( var prop in updates ) {
    this[prop] = updates[prop];
  }
  
  this.save( err => next(err) );

}

