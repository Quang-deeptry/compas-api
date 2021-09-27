/* eslint-disable no-console */
const { UserCheckScanProduct } = require('../models');

module.exports = {
  resetCheckScanProduct: async (fireDate) => {
    try {
      await UserCheckScanProduct.deleteMany({});
    } catch (error) {
      console.log(error);
    }
  },
};
