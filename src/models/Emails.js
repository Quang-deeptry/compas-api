const mongoose = require('mongoose');

const { Schema } = mongoose;

const listEmailSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'users',
  },
  restaurant: {
    type: Schema.Types.ObjectId,
    ref: 'restaurants',
  },
  email: {
    type: String,
    trim: true,
  },
  type: {
    type: String,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const Emails = mongoose.model('emails', listEmailSchema);

module.exports = Emails;
