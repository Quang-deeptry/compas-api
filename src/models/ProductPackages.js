const mongoose = require('mongoose');
const { PRODUCT_PACKAGE_STATUS } = require('../constants');

const { Schema } = mongoose;

const productPackageSchema = new Schema({
  images: {
    productCodeImages: [{
      type: Schema.Types.ObjectId,
      ref: 'media',
    }],
    invoiceImages: [{
      type: Schema.Types.ObjectId,
      ref: 'media',
    }],
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'users',
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'restaurants',
  },
  products: [{
    type: Schema.Types.ObjectId,
    ref: 'products',
  }],
  provider: {
    type: String,
  },
  orderCode: {
    type: String,
  },
  deliveryScheduled: {
    type: Date,
  },
  receivedDate: {
    type: Date,
    default: null,
  },
  quantity: {
    type: Number,
    default: 0,
  },
  totalPrice: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: [
      PRODUCT_PACKAGE_STATUS.RESERVOIR,
      PRODUCT_PACKAGE_STATUS.RECEPTION,
    ],
    default: PRODUCT_PACKAGE_STATUS.RESERVOIR,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const ProductPackages = mongoose.model('product_packages', productPackageSchema);

module.exports = ProductPackages;
