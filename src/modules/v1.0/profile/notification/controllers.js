/* eslint-disable max-len */
/* eslint-disable no-nested-ternary */
const moment = require('moment');
const schedule = require('node-schedule');
const {
  IndexProducts,
  UserManualChangeStatus,
  Restaurants,
} = require('../../../../models');

const {
  EMAIL_STATUS,
  PRODUCT_STATUS,
} = require('../../../../constants');
const {
  apiResponse, asyncForEach, matchRoundPrice,
} = require('../../../../helpers');
const smtpTransport = require('../../../../services/nodeMailer');

module.exports = {
  getNotifications: async (req, res, next) => {
    try {
      const { page, sort } = req.query;
      const conditionSort = { createdAt: -1 };
      switch (+sort) {
        case 2:
          conditionSort.createdAt = 1;
          break;
        default:
          conditionSort.createdAt = -1;
      }
      const findCondition = {
        user: req.user.id,
        referenceModel: NOTIFICATION_REF_MODEL.CLIENT,
      };

      const getNotifications = Notification.find(findCondition)
        .sort(conditionSort)
        .skip(ITEM_PER_PAGE * (page - 1))
        .limit(ITEM_PER_PAGE)
        .lean();
      const getTotalNotifications = Notification.countDocuments(findCondition);

      const [notifications, totalNotifications] = await Promise
        .all([getNotifications, getTotalNotifications]);

      return res.json(apiResponse({
        total: totalNotifications,
        payload: notifications,
      }));
    } catch (error) {
      next(error);
    }
  },

  updateNotificationsStatus: async (req, res, next) => {
    try {
      const { body: { listNotifications } } = req;
      const listPromises = [];

      for (let i = 0; i < listNotifications.length; i += 1) {
        listPromises[i] = Notification
          .findByIdAndUpdate(listNotifications[i], { isRead: true }, (err, doc) => {
            if (err) return next(apiErrors.badRequest);

            if (doc.user.toString() !== req.user.id.toString()) {
              return next(apiErrors.notificationNotFound);
            }

            if (doc.isRead) {
              return next(apiErrors.notificationNotFound);
            }
          });
      }

      await Promise.all(listPromises);
      return res.json(apiResponse({
        message: 'Cập nhật thông báo thành công!',
        payload: true,
      }));
    } catch (error) {
      next(error);
    }
  },

  createNotification: async (req, res, next) => {
    try {
      const { id } = req.user;
      const newNotification = await Notification.create({
        message: req.body.message,
        user: id,
        referenceModel: NOTIFICATION_REF_MODEL.CLIENT,
      });

      global.socketIO.to(global.listSocketUser.socketId[`client_${id}`]).emit('user-has-new-notification', newNotification);

      return res.json(true);
    } catch (error) {
      next(error);
    }
  },

  getUnreadNotificationNumber: async (req, res, next) => {
    try {
      const { id } = req.user;
      const checkLastTime = await Client.findById(id).select('lastTimeReadNoti');
      const countUnreadNoti = await Notification.countDocuments({
        isRead: false,
        user: id,
        createdAt: {
          $gte: checkLastTime.lastTimeReadNoti,
          $lte: new Date(),
        },
      });
      await Client.findByIdAndUpdate(id, { $set: { countUnreadNoti } });
      return res.json(apiResponse({ payload: countUnreadNoti }));
    } catch (error) {
      next(error);
    }
  },

  updateUnreadNotificationNumber: async (req, res, next) => {
    try {
      const { id } = req.user;
      await Client.findByIdAndUpdate(
        id,
        {
          $set: {
            countUnreadNoti: 0,
            lastTimeReadNoti: new Date(),
          },
        },
      );

      return res.json(apiResponse());
    } catch (error) {
      next(error);
    }
  },
};
