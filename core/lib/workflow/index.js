"use strict";

const graphlib = require('graphlib');
const Graph = graphlib.Graph;
const EventEmitter = require('events').EventEmitter;

function Workflow () {

  var _graph = new Graph();

  Object.defineProperty(this, 'graph', {
    get: function(){
      return graphlib.json.write(_graph);
    },
    set: function(obj) {
      _graph = graphlib.json.read(obj);
      return _graph;
    }
  });


  this.fromEvents = function (events) {
    var g = _graph;

    events.forEach( event => {
      var a = event.emitter;
      var b = event;

      if( ! g.hasNode(a._id) ){ g.setNode(a._id, a); }
      if( ! g.hasNode(b._id) ){ g.setNode(b._id, b); }
      g.setEdge(a._id, b._id);

      if( Array.isArray(a.triggers) && a.triggers.length > 0 ){
        // triggers is an array of event ids
        a.triggers.forEach( trigger => {
          g.setEdge(trigger, a._id);
        });
      }
    });

    return;
  }

  this.getPath = function (node) {
    //return graphlib.alg.dijkstra(_graph, node, null, function(v) { return h5.network.graph.nodeEdges(v); })
    var paths = graphlib.alg.dijkstra(_graph, node);

    var g = new Graph();

    Object.keys(paths).forEach( node => {
      var path = paths[node];
      if( path.distance != null && path.distance != Infinity ){
        if( ! g.hasNode(node) ){
          g.setNode( node, _graph.node(node) );
        }

        if( path.hasOwnProperty('predecessor') ) {
          var predecessor = path.predecessor;
          if( ! g.hasNode(predecessor) ){
            g.setNode( predecessor, _graph.node(predecessor) );
          }
          g.setEdge( predecessor, node );
        }
      }
    });

    return graphlib.json.write(g);
  }
}

module.exports = Workflow;
