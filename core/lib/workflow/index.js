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

    if (!events||!Array.isArray(events)||!(events.length>0)) return;

    function createNodeEvent ( event ) {
      var a = event.emitter;
      var b = event;

      if (!g.node(a._id)) { g.setNode(a._id, a); }
      if (!g.node(b._id)) { g.setNode(b._id, b); }
      g.setEdge(a._id, b._id);

      if (Array.isArray(a.triggers) && a.triggers.length > 0) {
        // triggers is an array of event ids
        a.triggers.forEach( trigger => {
          g.setEdge(trigger, a._id);
        });
      }
    }

    events.forEach( event => createNodeEvent(event) );

    return;
  }

  this.getPath = function (node) {
    var paths = graphlib.alg.dijkstra(_graph, node);

    var g = new Graph();

    Object.keys(paths).forEach( node => {
      var path = paths[node];
      if( !isNaN(parseInt(path.distance)) && isFinite(path.distance) ){
        if( !g.node(node) ){
          g.setNode( node, _graph.node(node) );
        }

        if( path.hasOwnProperty('predecessor') ) {
          var predecessor = path.predecessor;

          if( !g.node(predecessor) ){
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
