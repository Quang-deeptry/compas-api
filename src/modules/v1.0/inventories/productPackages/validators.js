const { check, body } = require('express-validator');

module.exports = {
  createdProductPackage: [
    check('provider').not().isEmpty().withMessage('Le nom du fournisseur est requis'),
    check('orderCode').not().isEmpty().withMessage('Le code de commande est requis'),
    check('deliveryScheduled').not().isEmpty().withMessage('La livraison planifiée est requise'),
    check('status').not().isEmpty().withMessage('Le statut est requis'),
  ],

  createdProduct: [
    check('converter', 'La valeur doit être numérique').custom((value, { req }) => (typeof (value) === 'number' && value > 0)),
    check('title').not().isEmpty().withMessage('Le titre est requis'),
    check('tariffs.unit').not().isEmpty().withMessage('L\'Unité Tarifaire est requise'),
    check('tariffs.price', 'La valeur doit être numérique').custom((value, { req }) => (typeof (value) === 'number' && value > 0)),
    check('unit').not().isEmpty().withMessage('L\'unité est requise'),
    check('quantity', 'La valeur doit être numérique').custom((value, { req }) => (typeof (value) === 'number' && value > 0)),
  ],
};
