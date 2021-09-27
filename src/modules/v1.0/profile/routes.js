const router = require('express')();
const reportRoutes = require('./report/routes');
const userManager = require('./userManager/routes');
const restaurantRoutes = require('./restaurantAndTarget/routes');
const managerRoutes = require('./manager/routes');
const notificationRoutes = require('./notification/routes');
const {
  checkAccessToken,
} = require('../middleware');

router.use('/report', reportRoutes);

router.use(checkAccessToken);

router.use('/user-manager', userManager);
router.use('/restaurant', restaurantRoutes);
router.use('/manager', managerRoutes);
router.use('/notification', notificationRoutes);

module.exports = router;
