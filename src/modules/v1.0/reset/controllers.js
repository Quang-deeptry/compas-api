const { apiResponse } = require('../../../helpers');
const {
  Emails,
  Users,
  Products,
  Restaurants,
  ProductPackages,
  UserScanProduct,
  UserCheckScanProduct,
  ProductCodes,
  IndexProducts,
  Media,
  UserManualChangeStatus,
  Histories,
  Notifications,
} = require('../../../models');

module.exports = {
  // DELETE in last version
  resetData: async (req, res, next) => {
    const deleteEmail = Emails.deleteMany({});
    const deleteHistories = Histories.deleteMany({});
    const deleteIndexProducts = IndexProducts.deleteMany({});
    const deleteMedia = Media.deleteMany({});
    const deleteNotifications = Notifications.deleteMany({});
    const deleteProductCodes = ProductCodes.deleteMany({});
    const deleteProductPackages = ProductPackages.deleteMany({});
    const deleteProduct = Products.deleteMany({});
    const deleteRestaurant = Restaurants.deleteMany({});
    const deleteUserCheckScanProduct = UserCheckScanProduct.deleteMany({});
    const deleteUser = Users.deleteMany({});
    const deleteUserManualChangeStatus = UserManualChangeStatus.deleteMany({});
    const deleteUserScanProduct = UserScanProduct.deleteMany({});

    await Promise.all([
      deleteEmail,
      deleteHistories,
      deleteIndexProducts,
      deleteMedia,
      deleteNotifications,
      deleteProductCodes,
      deleteProductPackages,
      deleteProduct,
      deleteRestaurant,
      deleteUserCheckScanProduct,
      deleteUser,
      deleteUserManualChangeStatus,
      deleteUserScanProduct,
    ]);

    res.json(apiResponse({
      message: 'Supprimer le succès',
    }));
  },

  // DELETE in last version
  resetProductData: async (req, res, next) => {
    const deleteHistories = Histories.deleteMany({});
    const deleteIndexProducts = IndexProducts.deleteMany({});
    const deleteMedia = Media.deleteMany({});
    const deleteNotifications = Notifications.deleteMany({});
    const deleteProductCodes = ProductCodes.deleteMany({});
    const deleteProductPackages = ProductPackages.deleteMany({});
    const deleteProduct = Products.deleteMany({});
    const deleteUserCheckScanProduct = UserCheckScanProduct.deleteMany({});
    const deleteUserManualChangeStatus = UserManualChangeStatus.deleteMany({});
    const deleteUserScanProduct = UserScanProduct.deleteMany({});

    await Promise.all([
      deleteHistories,
      deleteIndexProducts,
      deleteMedia,
      deleteNotifications,
      deleteProductCodes,
      deleteProductPackages,
      deleteProduct,
      deleteUserCheckScanProduct,
      deleteUserManualChangeStatus,
      deleteUserScanProduct,
    ]);

    res.json(apiResponse({
      message: 'Supprimer le succès',
    }));
  },
};
