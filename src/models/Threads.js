const mongoose = require('mongoose');

const { Schema } = mongoose;

const listThreadId = new Schema({
  threadId: {
    type: String,
  },
  snippet: {
    type: String,
  },
  historyId: {
    type: String,
  },
}, {
  timestamps: true,
  versionKey: false,
});

const Threads = mongoose.model('threads', listThreadId);

module.exports = Threads;
