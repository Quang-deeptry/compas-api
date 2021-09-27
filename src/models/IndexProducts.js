const mongoose = require('mongoose');

const { Schema } = mongoose;

const indexProductsSchema = new Schema({
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'restaurants',
  },
  productPackage: {
    type: Schema.Types.ObjectId,
    ref: 'product_packages',
  },
  title: {
    type: String,
    required: true,
  },
  oldTitle: {
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
  sku: {
    type: String,
  },
  provider: {
    type: String,
    required: true,
  },
  converter: {
    type: Number,
    default: 1,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const IndexProducts = mongoose.model('index_products', indexProductsSchema);

module.exports = IndexProducts;
