const mongoose = require('mongoose');

const { Schema } = mongoose;

const { HISTORY_REF_MODEL } = require('../constants');

const historiesSchema = new Schema({
  // productCode: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'productCodes',
  // },
  // product: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'products',
  // },
  // productPackage: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'productPackages',
  // },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'restaurants',
  },
  // referenceProduct: {
  //   type: Schema.Types.ObjectId,
  //   ref: 'index_products',
  // },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'users',
  },
  target: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'referenceModel',
  },
  referenceModel: {
    type: String,
    required: true,
    enum: [
      HISTORY_REF_MODEL.PRODUCT_PACKAGE,
      HISTORY_REF_MODEL.PRODUCT,
      HISTORY_REF_MODEL.PRODUCT_CODE,
    ],
    default: HISTORY_REF_MODEL.PRODUCT_CODE,
  },
  fieldChange: {
    type: String,
    require: true,
  },
  name: {
    type: String,
    require: true,
  },
  afterValue: {
    type: String,
    require: true,
  },
  beforeValue: {
    type: String,
    require: true,
  },
  isAuto: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const Histories = mongoose.model('histories', historiesSchema);

module.exports = Histories;
