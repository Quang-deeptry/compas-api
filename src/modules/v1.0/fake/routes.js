const express = require('express');

const router = express.Router();

const {
  fakeProduct,
  fakeReportEmail,
} = require('./controller');

router.route('/fakeProduct')
  .post(fakeProduct);

router.route('/fake-report-email')
  .post(fakeReportEmail);

module.exports = router;
