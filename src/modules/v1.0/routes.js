const express = require('express');

const router = express.Router();

const authRoutes = require('./auth/routes');
const profileRoutes = require('./profile/routes');
const inventoryRoutes = require('./inventories/routes');
const reset = require('./reset/routes');
const fakeProductRoutes = require('./fake/routes');
const histories = require('./histories/routes');

const {
  catch404,
  catchError,
} = require('./middleware');

router.use('/v1.0/auth', authRoutes);
router.use('/v1.0/reset', reset);
router.use('/v1.0', fakeProductRoutes);

router.use('/v1.0/profile', profileRoutes);
router.use('/v1.0/inventory', inventoryRoutes);
router.use('/v1.0/histories', histories);

router.use(catch404);
router.use(catchError);

module.exports = router;
