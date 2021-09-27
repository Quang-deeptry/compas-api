const express = require('express');

const router = express.Router();

const {
  checkRegister,
} = require('./validators');
const { tokenIsUser, uploadFile, checkRestaurantId } = require('./middlewares');
const { validateInput } = require('../../middleware');
const {
  checkAccessToken,
  checkPermission,
  isObjectId,
} = require('../../middleware');

const {
  onRegister,
  listUser,
  userDetail,
  onEditUser,
  getProfile,
  addUser,
  deleteUser,
  onEditProfile,
} = require('./controllers');

router.use(checkAccessToken);

router.route('/')
  .get(getProfile);

router.use(checkPermission);

router.route('/register')
  .get(addUser)
  .post(checkRegister, validateInput, uploadFile, onRegister);

router.route('/list-employee')
  .get(listUser);

router.route('/')
  .put(uploadFile, onEditProfile);

router.route('/:id')
  .get(isObjectId, tokenIsUser, userDetail)
  .put(isObjectId, tokenIsUser, uploadFile, onEditUser)
  .delete(deleteUser);

module.exports = router;
