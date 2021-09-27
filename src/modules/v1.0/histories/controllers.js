const {
  Histories,
  Users,
} = require('../../../models');
const {
  fuzzySearch,
  apiResponse,
} = require('../../../helpers');
const {
  ITEM_PER_PAGE,
} = require('../../../constants');

module.exports = {
  // Cần role Owner - Manager để truy cập: checkPermission

  getListHistory: async (req, res, next) => {
    try {
      const {
        query: {
          sort,
          page,
          q,
          isAuto,
          fieldChange,
        },
        user: { id },
      } = req;
      const userData = await Users.findById(id).lean();
      const currentPage = Math.ceil((!page || page <= 0) ? 1 : +page);
      const conditionSort = {};
      const conditionFind = {
        restaurant: { $in: userData.restaurants },
      };

      if (q) conditionFind.name = fuzzySearch(q);
      if (fieldChange) conditionFind.fieldChange = fuzzySearch(fieldChange);

      if (isAuto) {
        switch (Number(isAuto)) {
          case 0:
            conditionFind.isAuto = false;
            break;
          case 1:
            conditionFind.isAuto = true;
            break;
          default:
            conditionFind.isAuto = null;
        }
      }

      switch (Number(sort)) {
        case 2:
          conditionSort.updatedAt = 1;
          break;
        default:
          conditionSort.updatedAt = -1;
      }

      const histories = await Histories
        .aggregate()
        .match(conditionFind)
        .sort(conditionSort)
        .skip(ITEM_PER_PAGE * (currentPage - 1))
        .limit(ITEM_PER_PAGE);

      const count = await Histories
        .aggregate()
        .match(conditionFind)
        .count('total');

      return res.json(apiResponse({
        message: 'Obtenez tous les succès du code produit',
        total: count.length > 0 ? count[0].total : 0,
        payload: histories,
      }));
    } catch (error) {
      next(error);
    }
  },

};
