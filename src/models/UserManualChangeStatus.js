const mongoose = require('mongoose');

const { Schema } = mongoose;

const userManualChangeStatusSchema = new Schema({
  productCode: {
    type: Schema.Types.ObjectId,
    ref: 'productCodes',
  },
  product: {
    type: Schema.Types.ObjectId,
    ref: 'products',
  },
  productPackage: {
    type: Schema.Types.ObjectId,
    ref: 'productPackages',
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'restaurants',
  },
  referenceProduct: {
    type: Schema.Types.ObjectId,
    ref: 'index_products',
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'users',
  },
}, {
  timestamps: true,
  versionKey: false,
});

const UserManualChangeStatus = mongoose.model('user_manual_change_statuses', userManualChangeStatusSchema);

module.exports = UserManualChangeStatus;
