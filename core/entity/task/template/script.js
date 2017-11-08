'use strict';

const mongoose = require('mongoose')
const ObjectId = mongoose.Schema.Types.ObjectId
const BaseSchema = require('./schema') // template schema
//const Script = require('../../file').Script

const Argument = new mongoose.Schema({
  id: String,
  help: String,
  label: String,
  type: String,
  value: String,
  options: Array,
  order: Number,
  required: Boolean
})

const Schema = new BaseSchema({
  script: { type: ObjectId, ref: 'Script' }, // has one
  script_id: { type: ObjectId }, //has one
  script_arguments: [ Argument ],
  script_runas: { type: String, default: '' },
})

module.exports = Schema
