module.exports = {
  order: { type: Number, default: 0 },
  customer_id: { type: String },
  customer_name: { type: String },
  content_schema: { type: Object },
  acl: [{ type: String }],
  tags: { type: Array, default: [] },
  description: { type: String, default:'' },
  filename: { type: String },
  keyname: { type: String },
  mimetype: { type: String },
  extension: { type: String },
  size: { type: Number },
  md5: { type: String, default: null },
  //public: { type: Boolean, default: false },
}
