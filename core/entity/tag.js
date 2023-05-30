
const m2s = require('mongoose-to-swagger');
const mongodb = require("../lib/mongodb");
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const after = require('lodash/after')

const EntitySchema = Schema({
  name: { type: String },
  creation_date: { type: Date, 'default': new Date() },
  customer_id: { type: Schema.Types.ObjectId, ref: 'Customer' },
  customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
});

EntitySchema.virtual('id').get(function(){
  return this._id.toHexString();
});

const specs = {
  getters: true,
  virtuals: true,
  transform: function (doc, ret, options) {
    // remove the _id of every document before returning the result
    ret.id = ret._id;
    //delete ret._id;
    delete ret.__v;
  }
};

EntitySchema.set('toJSON', specs);
EntitySchema.set('toObject', specs);

EntitySchema.statics.create = (tags, customer, next) => {
  next||(next=function(){}); //malisimo esto
  if (!tags || tags.length===0) { return next() }
  var data = tags.map(tag => {
    return {
      name: tag,
      customer_id: mongoose.Types.ObjectId( customer._id ),
      customer: mongoose.Types.ObjectId( customer._id )
    }
  })

  // find or create
  var instances = []
  var created = after(data.length, () => next(null, instances))
  data.forEach(tag => {
    Entity.findOne(tag , (err, model) => {
      if (!model) {
        model = new Entity(tag)
        model.save(err => {
          if (!err) instances.push(model)
          created()
        })
      } else {
        instances.push(model)
        created()
      }
    })
  })
}

EntitySchema.index({ name: 1, customer: 1 },{ unique: true });

const Entity = mongodb.db.model('Tag', EntitySchema)
Entity.ensureIndexes()

exports.Entity = Entity
exports.Tag = Entity

exports.swagger = {
  components: {
    schemas: {
      Tag: m2s(Entity)
    }
  }
}
