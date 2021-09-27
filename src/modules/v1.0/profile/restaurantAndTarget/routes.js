const express = require('express');

const router = express.Router();

const {
  checkAccessToken,
  isObjectId,
} = require('../../middleware');

const {
  getRestaurants,
  getRestaurant,
} = require('./controllers');

router.use(checkAccessToken);

router.route('/')
  .get(getRestaurants);

router.route('/:id')
  .get(isObjectId, getRestaurant);

module.exports = router;
