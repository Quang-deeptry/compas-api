const { apiErrors } = require('../../../../helpers');
const { Products } = require('../../../../models');
const s3Service = require('../../../../services/s3');

module.exports = {
  uploadFiles: async (req, res, next) => {
    s3Service.upload.fields([{ name: 'images', maxCount: 10 }])(req, res, async (err) => {
      if (err) {
        return next(apiErrors.badRequest);
      }
      next();
    });
  },
};
