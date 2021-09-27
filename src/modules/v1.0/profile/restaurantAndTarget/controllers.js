const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongoose').Types;
const {
  Restaurants,
  Users,
} = require('../../../../models');
const {
  apiError,
  apiErrors,
  apiResponse,
  asyncForEach,
} = require('../../../../helpers');

const {
  LIST_ROLE,
} = require('../../../../constants');

module.exports = {
  getRestaurants: async (req, res, next) => {
    try {
      const { id } = req.user;
      const listRestaurant = {};

      const user = await Users.findById(id)
        .select('_id restaurants fullName phoneNumber role email username')
        .lean();

      if (user.role !== LIST_ROLE.OWNER) return next(apiErrors.badRequest);

      const restaurants = await Users
        .aggregate()
        .lookup({
          from: 'emails',
          localField: '_id',
          foreignField: 'user',
          as: 'emails',
        })
        .unwind({
          path: '$emails._id',
          preserveNullAndEmptyArrays: true,
        })
        .project({
          username: 1,
          password: 1,
          fullname: 1,
          emails: {
            email: 1,
            type: 1,
          },
          restaurants: 1,
        })
        .match({
          restaurants: { $in: user.restaurants },
        })
        .sort({ createdAt: -1 });

      await Users.populate(restaurants, {
        path: 'restaurants',
        select: '_id restaurantName',
      }).then((data) => {
        data.shift();
      });

      listRestaurant.owner = user;
      listRestaurant.employers = restaurants;

      return res.json(apiResponse({
        message: 'Obtenez le succès des restaurants',
        payload: listRestaurant,
      }));
    } catch (error) {
      next(error);
    }
  },
  getRestaurant: async (req, res, next) => {
    try {
      const { user: { id: userId }, params: { id: restaurantId } } = req;
      const listRestaurant = {};

      const user = await Users.findById(userId)
        .select('_id restaurants fullName phoneNumber role email username')
        .lean();

      if (user.role !== LIST_ROLE.OWNER) return next(apiErrors.badRequest);

      const restaurant = await Users
        .aggregate()
        .lookup({
          from: 'emails',
          localField: '_id',
          foreignField: 'user',
          as: 'emails',
        })
        .unwind({
          path: '$emails.email',
          preserveNullAndEmptyArrays: true,
        })
        .project({
          username: 1,
          password: 1,
          emails: {
            email: 1,
            type: 1,
          },
          restaurants: 1,
        })
        .match({
          restaurants: { $in: [ObjectId(restaurantId)] },
        })
        .sort({ createdAt: -1 });

      await Users.populate(restaurant, {
        path: 'restaurants',
        select: '_id restaurantName',
      })
        .then((data) => data.shift());

      listRestaurant.owner = user;
      listRestaurant.employers = restaurant;

      return res.json(apiResponse({
        message: 'Obtenez le succès des détails du restaurant',
        payload: listRestaurant,
      }));
    } catch (error) {
      next(error);
    }
  },
  // stop
  // createRestaurant: async (req, res, next) => {
  //   try {
  //     const { id } = req.user;
  //     const {
  //       restaurantName, street, number, city, zipCode,
  //     } = req.body;

  //     const address = {
  //       street, number, city, zipCode,
  //     };

  //     const user = await Users.findOne({ _id: id })
  //       .populate('restaurants')
  //       .select('restaurants')
  //       .lean();

  //     if (!user) return next(apiErrors.notFound);

  //     const restaurant = await Restaurants.findOne({ restaurantName }).lean();

  //     if (restaurant) {
  //       return res.status(400).json(apiError({
  //         message: `${restaurantName} existe déjà!`,
  //       }));
  //     }

  //     const newRestaurant = await Restaurants.create({
  //       restaurantName,
  //       address,
  //     });

  //     await Users.findOneAndUpdate(
  //       { _id: id },
  //       { $push: { restaurants: newRestaurant._id } },
  //     );

  //     return res.json(apiResponse({
  //       message: 'Créez le succès',
  //     }));
  //   } catch (error) {
  //     next(error);
  //   }
  // },
  // updateRestaurant: async (req, res, next) => {
  //   try {
  //     const { id } = req.params;
  //     const {
  //       restaurantName, street, number, zipCode, city,
  //     } = req.body;

  //     const address = {
  //       street,
  //       number,
  //       city,
  //       zipCode,
  //     };

  //     const restaurant = await Restaurants.findOne({ restaurantName });

  //     if (restaurant) {
  //       return res.status(400).json(apiError({
  //         message: `${restaurantName} existe déjà!`,
  //       }));
  //     }

  //     const restaurantUpdate = await Restaurants.findOneAndUpdate(
  //       { _id: id },
  //       { $set: { restaurantName, address } },
  //     );

  //     if (!restaurantUpdate) return next(apiErrors.notFound);

  //     return res.json(apiResponse({
  //       message: 'Mise à jour réussie',
  //     }));
  //   } catch (error) {
  //     next(error);
  //   }
  // },
  // deleteRestaurant: async (req, res, next) => {
  //   try {
  //     const { id } = req.params;
  //     const { user } = req;

  //     await Users.findOneAndUpdate(
  //       { _id: user.id },
  //       {
  //         $pull: { restaurants: id },
  //       },
  //       (error) => {
  //         if (error) return res.status(400).json(apiError({ error }));
  //         Restaurants.findOneAndDelete(
  //           { _id: id },
  //           (err) => {
  //             if (err) return res.status(400).json(apiError({ err }));
  //           },
  //         );
  //         return res.json(apiResponse({
  //           message: 'Suppression réussie',
  //         }));
  //       },
  //     );
  //   } catch (error) {
  //     next(error);
  //   }
  // },
};
