function properties () {
  var alt = {};
  var storeKey = function(key) {
    alt[key] = this[key];
  };
  Object.getOwnPropertyNames(this).forEach(storeKey, this);
  return alt;
}

Object.defineProperty(Error.prototype,'toJSON',{
  configurable: true,
  value: properties
});

Object.defineProperty(Error.prototype,'toString',{
  configurable: true,
  value: properties
});
