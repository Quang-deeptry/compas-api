const mongoose = require('mongoose');

const { Schema } = mongoose;

const { PRODUCT_STATUS } = require('../constants');

const userScanSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'users',
  },
  productCode: {
    type: Schema.Types.ObjectId,
    ref: 'product_codes',
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'restaurants',
  },
  productPackage: {
    type: Schema.Types.ObjectId,
    ref: 'product_packages',
  },
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

const UserScanProduct = mongoose.model('user_scan_product', userScanSchema);

module.exports = UserScanProduct;
