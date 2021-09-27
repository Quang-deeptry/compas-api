const { check } = require('express-validator');

module.exports = {
  checkRegister: [
    check('restaurantName').not().isEmpty().withMessage('Le nom du restaurant est obligatoire'),
    check('street').not().isEmpty().withMessage('La rue est obligatoire'),
    check('number').not().isEmpty().withMessage('Le numéro est requis'),
    check('city').not().isEmpty().withMessage('La ville est obligatoire'),
    check('zipCode').not().isEmpty().withMessage('Le code postal est requis'),
    check('email')
      .not().isEmpty().withMessage('L\'email est obligatoire!')
      .isEmail()
      .withMessage('Veuillez saisir le format d\'e - mail correct'),
    check('fullName').not().isEmpty().withMessage('Le nom complet est requis'),
    check('phoneNumber').not().isEmpty().matches(/^((\+)33)[1-9](\d{2}){4}$/, 'g')
      .withMessage('Phone Le numéro est requis!'),
    check('username').not().isEmpty().withMessage('Nom d\'utilisateur est nécessaire'),
    check('password').not().isEmpty().withMessage('Mot de passe requis')
      .isLength({ min: 6 })
      .withMessage('Doit comporter au moins 6 caractères'),
  ],
  checkLogin: [
    check('username').not().isEmpty().withMessage('Nom d\'utilisateur est nécessaire'),
    check('password').not().isEmpty().withMessage('Mot de passe requis!')
      .isLength({ min: 6 })
      .withMessage('Doit comporter au moins 6 caractères'),
  ],
  checkLogout: [
    check('username').not().isEmpty().withMessage('Nom d\'utilisateur est nécessaire'),
    check('password').not().isEmpty().withMessage('Mot de passe requis'),
  ],
  checkRecover: [
    check('email').not().isEmpty().withMessage('L\'e - mail est requis'),
  ],
  checkCode: [
    check('resetPasswordCode').not().isEmpty().withMessage('Le code est requis'),
    check('userId').not().isEmpty().withMessage('L\'identifiant de l\'utilisateur est requis'),
  ],
  checkResetPassword: [
    check('userId').not().isEmpty().withMessage('L\'identifiant de l\'utilisateur est requis'),
    check('password').not().isEmpty().isLength({ min: 6 })
      .withMessage('Doit comporter au moins 6 caractères'),
    check('confirmPassword', 'Les mots de passe ne correspondent pas').custom((value, { req }) => (value === req.body.password)),
  ],
  checkChangePassword: [
    check('password').not().isEmpty().withMessage('Mot de passe requis'),
    check('newPassword').not().isEmpty().withMessage('Un nouveau mot de passe est requis')
      .isLength({ min: 6 })
      .withMessage(' Doit comporter au moins 6 caractères'),
    check('confirmPassword', 'Confirmez le mot de passe incorrect, veuillez réessayer').custom((value, { req }) => (value === req.body.newPassword)),
  ],
};
