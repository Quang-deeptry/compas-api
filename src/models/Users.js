const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const helpers = require('../helpers');

const { Schema } = mongoose;

const { LIST_ROLE } = require('../constants');

const userSchema = new Schema({
  restaurants: [{
    type: Schema.Types.ObjectId,
    ref: 'restaurants',
  }],
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
  },
  fullName: {
    type: String,
    require: true,
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  username: {
    type: String,
    require: true,
    trim: true,
  },
  password: {
    type: String,
    require: true,
  },
  role: {
    type: String,
    enum: [LIST_ROLE.OWNER, LIST_ROLE.MANAGER, LIST_ROLE.EMPLOYEER],
    default: LIST_ROLE.OWNER,
  },
  gender: {
    type: String,
    enum: ['FEMALE', 'MALE', 'CUSTOM'],
    default: 'CUSTOM',
  },
  avatar: {
    type: String,
    default: '',
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  resetPasswordExpires: {
    type: Date,
  },
  resetPasswordCode: {
    type: String,
  },
}, {
  timestamps: true,
  versionKey: false,
});

userSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compareSync(candidatePassword, this.password);
};

userSchema.methods.generatePasswordReset = function generatePasswordReset() {
  this.resetPasswordCode = helpers.generateCodeNumber();
  this.resetPasswordExpires = Date.now() + 1000 * 60 * 5; // expires in a minute
};

const Users = mongoose.model('users', userSchema);

module.exports = Users;
