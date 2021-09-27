const express = require('express');

const router = express.Router();

const {
  resetScanOfRestaurant,
} = require('./controllers');

router.route('/scan')
  .post(resetScanOfRestaurant);

module.exports = router;
