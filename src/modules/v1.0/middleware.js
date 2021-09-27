const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongoose').Types;
const {
  checkValidateErrors,
  apiErrors,
  apiError,
} = require('../../helpers');
const { Users } = require('../../models');
const {
  LIST_ROLE,
} = require('../../constants');

module.exports = {
  validateInput: (req, res, next) => {
    const haveErrors = checkValidateErrors(req);

    if (haveErrors) {
      return res.status(400).json(apiError({
        message: 'Validation échouée',
        errors: haveErrors.errors,
      }));
    }

    next();
  },
  checkAccessToken: async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (token === null) return next(apiErrors.invalidAuthToken);

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
      if (err) {
        return res.status(401).json(apiError({
          message: 'Erreurs non autorisées',
          errors: err,
        }));
      }
      const isUser = await Users.findOne({ _id: user.id }).lean();

      if (!isUser) return next(apiErrors.unauthorized);

      req.user = user;
      next();
    });
  },
  checkPermission: async (req, res, next) => {
    try {
      const { id } = req.user;
      const user = await Users.findOne({ _id: id }).lean();

      if (!user) return next(apiErrors.notFound);

      if (user.role === LIST_ROLE.OWNER || user.role === LIST_ROLE.MANAGER) {
        return next();
      }

      return next(apiErrors.notFound);
    } catch (error) {
      next(error);
    }
  },
  isObjectId: async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) return next(apiErrors.badRequest);

      next();
    } catch (error) {
      next(error);
    }
  },
  catch404: (req, res, next) => next(apiErrors.notFound),

  catchError: (err, req, res, next) => {
    if (err.status) {
      return res.status(err.status).json(err);
    }

    res.status(500).json({
      ...apiErrors.serverError,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });
  },
};
