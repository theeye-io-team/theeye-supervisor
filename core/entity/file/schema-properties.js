'use strict'
module.exports = {
  order: { type: Number, default: 0 },
  customer_id: { type: String },
  customer_name: { type: String },
  filename: { type: String },
  keyname: { type: String },
  mimetype: { type: String },
  extension: { type: String },
  size: { type: Number },
  description: { type: String, default:'' },
  md5: { type: String, default: null },
  public : { type: Boolean, default: false },
  tags: { type: Array, default: [] }
}
