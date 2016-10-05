
var elastic = require('../core/lib/elastic');

var stats =  {
  "cpu_user":0,
  "cpu_system":0,"cpu_idle":0,"load_1_minute":0,"load_5_minute":0,"load_15_minute":0,"mem_used":872427520,"mem_free":1274662912,"mem_total":2147074048,"cacheTotal":0,"cacheFree":0,
  "net": {"total":{"receive":0,"send":0}},
  "disk":{
    "total":{"read":{"count":0,"sector":0,"time":0},"write":{"count":0,"sector":0,"time":0}},
    "C":{
      "read":{"count":0,"sector":0,"time":0},
      "write":{"count":0,"sector" :0,"time":0},
      "usage":{"total":31843151872,"used":20844318720,"available":10998833152}
    }
  }
}

elastic.submit('facugon','demo-host-stats',{
  hostname:'WIN-JRUD2U01C00',
  stats:stats
});
