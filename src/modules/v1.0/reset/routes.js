const express = require('express');

const router = express.Router();

const {
  resetData, resetProductData,
} = require('./controllers');

router.route('/delete-all-data')
  .post(resetData);

router.route('/delete-product-data')
  .post(resetProductData);

module.exports = router;
