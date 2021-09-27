const mongoose = require('mongoose');

const { Schema } = mongoose;

const { PRODUCT_STATUS } = require('../constants');

const productSchema = new Schema({
  // images: [String],
  user: {
    type: Schema.Types.ObjectId,
    ref: 'users',
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'restaurants',
  },
  productPackage: {
    type: Schema.Types.ObjectId,
    ref: 'product_packages',
  },
  mergeIndexProduct: {
    type: Schema.Types.ObjectId,
    ref: 'index_products',
  },
  referenceProduct: {
    type: Schema.Types.ObjectId,
    ref: 'index_products',
  },
  sku: { type: String },
  title: {
    type: String,
    require: true,
    trim: true,
  },
  slug: {
    type: String,
    require: true,
    unique: true,
    trim: true,
  },
  tariffs: {
    unit: { type: String },
    price: { type: Number },
  },
  converter: {
    type: Number,
    default: 1,
  },
  receivedDate: {
    type: Date,
    default: null,
  },
  expDate: {
    type: Date,
    default: null,
  },
  unit: { type: String },
  quantity: { type: Number },
  totalPrice: { type: Number },
  status: {
    type: String,
    enum: [
      PRODUCT_STATUS.INCOMING,
      PRODUCT_STATUS.FULL,
    ],
    default: PRODUCT_STATUS.INCOMING,
  },
}, {
  timestamps: true,
  versionKey: false,
});

productSchema.index({ slug: 1 }, { background: true, unique: true });

const Products = mongoose.model('products', productSchema);

module.exports = Products;
