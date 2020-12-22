'use strict'

const graphlib = require('graphlib');
const Graph = graphlib.Graph;
const EventEmitter = require('events').EventEmitter;
const logger = require('../logger')('lib:workflow')

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

    if (!events || !Array.isArray(events) || events.length<=0) return

    for (let idx in events) {
      let event = events[idx]
      if (event) {
        //logger.debug('processing event %o',event)

        let a = event.emitter
        let b = event

        if (a) {
          if (!g.node(a._id)) { g.setNode(a._id, a) }
          if (!g.node(b._id)) { g.setNode(b._id, b) }
          g.setEdge(a._id, b._id)

          if (Array.isArray(a.triggers) && a.triggers.length > 0) {
            // triggers is an array of event ids
            a.triggers.forEach( trigger => {
              g.setEdge(trigger, a._id)
            })
          }
        } else {
          logger.error('event emitter has been lost')
        }
      } else {
        logger.error('event information is missing')
        // event is undefined
      }
    }

    return
  }

  this.getPath = function (node) {
    var g = new Graph();

    if( !g.node(node) ){
      g.setNode( node, _graph.node(node) )
    }

    function addSuccessors(node) {
      var successors = _graph.successors(node)
      successors.forEach(function(succesor) {
        if( !g.node(succesor) ){
          g.setNode( succesor, _graph.node(succesor) )
        }
        g.setEdge( node, succesor );
        addSuccessors(succesor)
      })
    }

    addSuccessors(node)

    return graphlib.json.write(g);
  }
}

module.exports = Workflow;
