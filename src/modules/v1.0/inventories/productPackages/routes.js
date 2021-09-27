const express = require('express');

const router = express.Router();

const {
  validateInput,
  checkPermission,
  isObjectId,
} = require('../../middleware');

const {
  getProductPackageInfo,

  getProductInProductPackage,

  getProductPackageList,
  manualCreatedProductPackage,

  manualCreatedProduct,
  updateProductPackage,
  deleteProductPackage,

  onPrintCodeInProductPackage,

  onUpdateProductImages,

  onDeleteImages,
} = require('./controllers');

const {
  uploadFiles,
} = require('./middlewares');

const {
  createdProductPackage,
  createdProduct,
} = require('./validators');

router.route('/:id')
  .get(isObjectId, getProductPackageInfo);

router.use(checkPermission);

router.route('/list-product/:id')
  .get(isObjectId, getProductInProductPackage);

router.route('/')
  .get(getProductPackageList)
  .post(createdProductPackage, validateInput, manualCreatedProductPackage);

router.route('/:id')
  .post(createdProduct, validateInput, manualCreatedProduct)
  .put(createdProductPackage, validateInput, updateProductPackage)
  .delete(isObjectId, deleteProductPackage);

router.route('/print-code/:id')
  .get(onPrintCodeInProductPackage);

router.route('/edit/:id')
  .put(isObjectId, uploadFiles, onUpdateProductImages);

router.route('/delete/:id')
  .delete(isObjectId, onDeleteImages);

module.exports = router;
