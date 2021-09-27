const express = require('express');

const router = express.Router();

const productsRoutes = require('./products/routes');
const productPackageRoutes = require('./productPackages/routes');
const resetRoutes = require('./reset/routes');

const {
  checkAccessToken,
} = require('../middleware');

router.use(checkAccessToken);

router.use('/products', productsRoutes);

router.use('/product-packages', productPackageRoutes);

router.use('/reset', resetRoutes);

module.exports = router;
