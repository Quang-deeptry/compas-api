const express = require('express');

const router = express.Router();

const {
  checkPermission,
  isObjectId,
} = require('../../middleware');
const {
  onScanToUsingProductCode,
  onEditStatusOfProductCode,

  onViewDetailOfProductCode,

  onGetSuggestionProduct,

  onPrintCodesOfProduct,
  onUpdateProduct,

  listAllProductCode,

  onScanToFindProductCode,

  onToggleCheckScanProductCode,
  onUnCheckScanProductCode,

  onMergeProduct,
} = require('./controllers');

router.route('/:id')
  .post(isObjectId, onScanToUsingProductCode)
  .put(isObjectId, onEditStatusOfProductCode);

router.route('/detail/:id')
  .get(isObjectId, onViewDetailOfProductCode);

router.use(checkPermission);

router.route('/suggestion')
  .get(onGetSuggestionProduct);

router.route('/code-of-product/:id')
  .get(isObjectId, onPrintCodesOfProduct)
  .put(isObjectId, onUpdateProduct);

router.route('/all-product')
  .get(listAllProductCode);

router.route('/:id')
  .get(isObjectId, onScanToFindProductCode);

router.route('/check-product/:id')
  .post(isObjectId, onToggleCheckScanProductCode)
  .delete(isObjectId, onUnCheckScanProductCode);

router.route('/merge-product/:id')
  .post(isObjectId, onMergeProduct);

module.exports = router;
