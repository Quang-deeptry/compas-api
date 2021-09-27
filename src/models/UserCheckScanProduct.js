const mongoose = require('mongoose');

const { Schema } = mongoose;

const userCheckScanSchema = new Schema({
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
}, {
  timestamps: true,
  versionKey: false,
});

const UserCheckScanProduct = mongoose.model('user_check_scan_products', userCheckScanSchema);

module.exports = UserCheckScanProduct;
