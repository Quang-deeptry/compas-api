const { apiResponse } = require('../../../../helpers');
const {
  UserCheckScanProduct,
  Users,
} = require('../../../../models');

module.exports = {
  resetScanOfRestaurant: async (req, res, next) => {
    try {
      const { user: { id: user } } = req;
      const userData = await Users.findById(user).select('restaurants');

      const conditionFindToDelete = {
        restaurant: { $in: userData.restaurants },
      };

      await UserCheckScanProduct.deleteMany(conditionFindToDelete);

      res.json(apiResponse({
        message: 'Réinitialiser le succès de l\'analyse',
      }));
    } catch (error) {
      console.log(error);
    }
  },

};
