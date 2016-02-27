var port=8080;
console.log('listen on 0.0.0.0 port ' + port);
var proxy = require("http-proxy-simple").createProxyServer({
  host: "0.0.0.0",
  port: port
});

proxy.on("connection-open", function (cid, socket) {
  console.log("proxy: " + cid + ": TCP connection open");
});

proxy.on("connection-error", function (cid, socket, error) {
  console.log("proxy: " + cid + ": TCP connection error: " + error);
});

proxy.on("connection-close", function (cid, socket, had_error) {
  console.log("proxy: " + cid + ": TCP connection close");
});

proxy.on("http-request", function (cid, request, response) {
  console.log("proxy: " + cid + ": HTTP request: " + request.url);
});

proxy.on("http-error", function (cid, error, request, response) {
  console.log("proxy: " + cid + ": HTTP error: " + error);
});

proxy.on("http-intercept-request", function (cid, request, response, remoteRequest, performRequest) {
  console.log("proxy: " + cid + ": HTTP intercept request");
  performRequest(remoteRequest);
});

proxy.on("http-intercept-response", 
  function (
    cid, 
    request, 
    response, 
    remoteResponse, 
    remoteResponseBody, 
    performResponse
  ) {
    console.log("proxy: " + cid + ": HTTP intercept response");
    if (   
      remoteResponse.headers["content-type"] && 
      remoteResponse.headers["content-type"].toLowerCase() === "text/html"
    )
    {
      var body = remoteResponseBody.toString("utf8");
      var css = "<style>body { border: 10px solid red !important; }</style>";
      remoteResponseBody = body.replace(/(<\/head>)/i, css + "$1");
      remoteResponse.headers["content-length"] = remoteResponseBody.length;
      console.log("proxy: " + cid + ": HTTP intercept response: MODIFIED RESPONSE BODY");
    }

    if( typeof remoteResponse.headers[('Access-Control-Allow-Origin').toLowerCase()] == 'undefined' )
    {
      console.log(remoteResponse.headers);
      console.log("setting missing CORS headers");
      response.setHeader('Access-Control-Allow-Origin','*');
    }
    //response.setHeader('Access-Control-Expose-Headers', '*');
    performResponse(remoteResponse, remoteResponseBody);
  });
