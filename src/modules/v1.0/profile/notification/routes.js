const express = require('express');

const router = express.Router();

const {
  checkAccessToken,
  isObjectId,
} = require('../../middleware');

const {
  getNotifications,
  updateNotificationsStatus,
  createNotification,
} = require('./controllers');

router.use(checkAccessToken);

router.route('/')
  .get(getNotifications)
  .post(createNotification);

router.route('/:id')
  .get(isObjectId, updateNotificationsStatus);

module.exports = router;
