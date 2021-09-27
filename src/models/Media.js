const mongoose = require('mongoose');

const { Schema } = mongoose;

const {
  MEDIA_STATUS,
} = require('../constants');

const mediaSchema = new Schema({
  productPackages: {
    type: Schema.Types.ObjectId,
    ref: 'product_packages',
  },
  image: {
    type: String,
  },
  type: {
    type: String,
    enum: [
      MEDIA_STATUS.INVOICE_IMAGES,
      MEDIA_STATUS.PRODUCT_CODE_IMAGES,
    ],
    default: null,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const Media = mongoose.model('media', mediaSchema);

module.exports = Media;
