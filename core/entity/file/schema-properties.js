module.exports = {
  acl: [{ type: String }],
  content_schema: { type: Object },
  creation_date: { type: Date },
  customer_id: { type: String },
  customer_name: { type: String },
  description: { type: String, default:'' },
  extension: { type: String },
  filename: { type: String },
  keyname: { type: String }, // old property. @TODO: DEPRECATE
  last_update: { type: Date },
  md5: { type: String, default: null },
  mimetype: { type: String },
  order: { type: Number, default: 0 },
  size: { type: Number },
  storage_key: { type: String }, // new property
  tags: { type: Array, default: [] },
}
