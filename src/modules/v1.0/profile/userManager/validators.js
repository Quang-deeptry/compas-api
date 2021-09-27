const { check } = require('express-validator');

module.exports = {
  checkRegister: [
    check('fullName').not().isEmpty()
      .withMessage('Le nom complet est requis'),
    check('username').not().isEmpty().withMessage('Nom d\'utilisateur est nécessaire!'),
    check('restaurantId').not().isEmpty().withMessage('Veuillez choisir un restaurant '),
    check('password').not().isEmpty().withMessage('Mot de passe requis')
      .isLength({ min: 6 })
      .withMessage('Mot de passe d\'au moins 6 caractères'),
  ],
};
