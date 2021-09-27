const mongoose = require('mongoose');

const { Schema } = mongoose;

const RestaurantSchema = new Schema({
  restaurantName: {
    type: String,
    require: true,
    trim: true,
    unique: true,
  },
  address: {
    street: { type: String, require: true },
    number: { type: String, require: true },
    city: { type: String, require: true },
    zipCode: { type: String, require: true },
  },
}, {
  timestamps: true,
  versionKey: false,
});

const Restaurants = mongoose.model('restaurants', RestaurantSchema);

module.exports = Restaurants;
