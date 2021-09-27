const mongoose = require('mongoose');

const { Schema } = mongoose;

const { PRODUCT_STATUS } = require('../constants');

const productCodeSchema = new Schema({
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
  product: {
    type: Schema.Types.ObjectId,
    ref: 'products',
  },
  referenceProduct: {
    type: Schema.Types.ObjectId,
    ref: 'index_products',
  },
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
  expDate: {
    type: Date,
    default: null,
  },
  receivedDate: {
    type: Date,
    default: null,
  },
  openDate: {
    type: Date,
    default: null,
  },
  finishedDate: {
    type: Date,
    default: null,
  },
  unit: { type: String },
  quantity: { type: Number },
  totalPrice: { type: Number },
  sku: { type: String },
  status: {
    type: String,
    enum: [
      PRODUCT_STATUS.INCOMING,
      PRODUCT_STATUS.FULL,
      PRODUCT_STATUS.OPEN,
      PRODUCT_STATUS.EMPTY,
    ],
    default: PRODUCT_STATUS.INCOMING,
  },
}, {
  timestamps: true,
  versionKey: false,
});

productCodeSchema.index({ slug: 1 }, { background: true, unique: true });

const ProductCodes = mongoose.model('product_codes', productCodeSchema);

module.exports = ProductCodes;
