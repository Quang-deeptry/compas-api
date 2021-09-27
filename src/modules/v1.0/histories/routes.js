const express = require('express');

const router = express.Router();

const {
  checkPermission,
} = require('../middleware');
const {
  getListHistory,
} = require('./controllers');

const {
  checkAccessToken,
} = require('../middleware');

router.use(checkAccessToken);
router.use(checkPermission);

router.route('/')
  .get(getListHistory);

module.exports = router;
