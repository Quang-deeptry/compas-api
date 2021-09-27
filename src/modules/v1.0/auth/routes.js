const express = require('express');

const router = express.Router();

const { validateInput, checkAccessToken } = require('../middleware');

const {
  onRegister,
  onLogin,
  onLogout,
  changePassword,
  recover,
  validationCode,
  resetPassword,
} = require('./controllers');
const {
  checkRegister,
  checkLogin,
  checkChangePassword,
  checkRecover,
  checkCode,
  checkResetPassword,
} = require('./validators');

router.route('/register')
  .post(checkRegister, validateInput, onRegister);

router.route('/login')
  .post(checkLogin, validateInput, onLogin);

router.route('/recover')
  .post(checkRecover, validateInput, recover);

router.route('/send-code')
  .post(checkCode, validateInput, validationCode);

router.route('/reset-password')
  .post(checkResetPassword, validateInput, resetPassword);

router.use(checkAccessToken);

router.route('/logout')
  .post(onLogout);

router.route('/change-password')
  .put(checkChangePassword, validateInput, changePassword);

module.exports = router;
