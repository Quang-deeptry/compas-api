const { check } = require('express-validator');

module.exports = {
  checkCreateRestaurant: [
    check('restaurantName').not().isEmpty().withMessage('Le nom du restaurant est obligatoire'),
    check('street').not().isEmpty().withMessage('La rue est obligatoire'),
    check('number').not().isEmpty().withMessage('Le numéro est requis'),
    check('city').not().isEmpty().withMessage('La ville est obligatoire'),
    check('zipCode').not().isEmpty().withMessage('le code postal est requis'),
  ],
};
