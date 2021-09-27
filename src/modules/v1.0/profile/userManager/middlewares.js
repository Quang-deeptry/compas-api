/* eslint-disable no-unreachable */
const { ObjectId } = require('mongoose').Types;
const { Users } = require('../../../../models');
const s3Service = require('../../../../services/s3');
const { apiErrors } = require('../../../../helpers');

module.exports = {
  tokenIsUser: async (req, res, next) => {
    const userId = req.user.id;

    const userManager = await Users.findById(userId)
      .populate({ path: 'restaurants', select: 'restaurantName address' })
      .populate({ path: 'listEmail', select: 'email type' })
      .lean();

    if (!userManager) return next(apiErrors.badRequest);

    req.user.userManager = userManager;
    return next();
  },
  uploadFile: (req, res, next) => {
    s3Service.upload.single('avatar')(req, res, async (err) => {
      if (err) {
        return next(apiErrors.badRequest);
      }
      return next();
    });
  },
  checkRestaurantId: (req, res, next) => {
    const { restaurantId } = req.body;
    if (!restaurantId || !ObjectId.isValid(restaurantId)) return next(apiErrors.badRequest);
    next();
  },
};
