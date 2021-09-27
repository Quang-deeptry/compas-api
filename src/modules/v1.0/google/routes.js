const express = require('express');

const router = express.Router();

const {
  googleAuthCallback,
} = require('./controllers');

router.route('/callback')
  .get(googleAuthCallback);

module.exports = router;
