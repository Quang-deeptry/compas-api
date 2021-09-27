/* eslint-disable no-unused-vars */
/* eslint-disable no-unneeded-ternary */
const { ObjectId } = require('mongoose').Types;
const bcrypt = require('bcryptjs');
const sharp = require('sharp');
const {
  Users,
  Restaurants,
  Emails,
  ProductCodes,
  Products,
  UserCheckScanProduct,
  UserManualChangeStatus,
  ProductPackages,
  UserScanProduct,
} = require('../../../../models');
const { decodedToken } = require('../../../../services/jwt');
const {
  asyncForEach,
  apiResponse,
  apiError,
  apiErrors,
  validateEmail,
  compareResult,
  regexPhoneNumber,
} = require('../../../../helpers');
const {
  LIST_ROLE,
  EMAIL_STATUS,
} = require('../../../../constants');

module.exports = {
  addUser: async (req, res, next) => {
    try {
      const { id } = req.user;

      const user = await Users.findById(id)
        .populate({
          path: 'restaurants',
          select: '_id restaurantName',
        })
        .lean();

      if (user.role !== LIST_ROLE.OWNER) return next(apiErrors.notFound);
      return res.json(apiResponse({
        payload: user.restaurants,
      }));
    } catch (error) {
      next(error);
    }
  },
  onRegister: async (req, res, next) => {
    try {
      const {
        body: {
          fullName, username, password, role,
          emailScan, emailReport, acceptEmailScan, acceptEmailReport, restaurantId,
        },
        user: { id },
      } = req;

      const errors = [];
      const isRole = {};
      const newEmail = {};
      let avatar = '';
      let isReport = false;

      if (!ObjectId.isValid(restaurantId)) {
        errors.push({
          msg: 'Le restaurant existe déjà',
          param: 'restaurant',
          location: 'body',
        });
      }

      switch (role) {
        case LIST_ROLE.MANAGER:
          isRole.role = LIST_ROLE.MANAGER;
          break;
        case LIST_ROLE.EMPLOYEER:
          isRole.role = LIST_ROLE.EMPLOYEER;
          break;
        default:
          return next(apiErrors.badRequest);
      }

      const user = await Users.findById({ _id: id });

      if (!user) return next(apiErrors.invalidAuthToken);

      if (user.role !== LIST_ROLE.OWNER) return next(apiErrors.notFound);

      const checkUser = await Users.findOne({ username });

      if (checkUser) return next(apiErrors.usernameExists);

      if (acceptEmailScan && emailScan) {
        if (!validateEmail(emailScan)) {
          errors.push({
            body: 'email scan',
            value: emailScan,
            msg: 'L\'analyse des e - mails n\'est pas valide',
            param: 'emailScan',
          });
        }

        const checkEmail = await Emails.findOne({ email: emailScan, type: EMAIL_STATUS.RECEIVE });

        if (checkEmail) {
          errors.push({
            msg: 'L\'email reçu BL existe déjà',
            location: 'body',
            param: 'emailScan',
          });
        } else {
          newEmail.emailScan = emailScan;
          newEmail.typeScan = EMAIL_STATUS.RECEIVE;
        }
      }

      if (acceptEmailReport && emailReport) {
        if (!validateEmail(emailReport)) {
          errors.push({
            body: 'email report',
            value: emailReport,
            msg: 'L\'analyse des e - mails n\'est pas valide',
            param: 'emailReport',
          });
        }

        const checkEmail = await Emails.findOne({ email: emailReport, type: EMAIL_STATUS.REPORT });

        if (checkEmail) {
          errors.push({
            msg: 'L\'email pour recevoir le rapport existe déjà',
            location: 'body',
            param: 'emailReport',
          });
        } else {
          newEmail.emailReport = emailReport;
          newEmail.typeReport = EMAIL_STATUS.REPORT;
          isReport = true;
        }
      }

      if (errors.length > 0) {
        return res.status(400).json(apiError({
          message: 'Les erreurs',
          errors,
        }));
      }

      if (req.file) {
        avatar = req.file.transforms[0].location;
      }

      if (user.restaurants.length > 0) {
        await Promise.all(
          user.restaurants.map(async (objectId) => {
            if (objectId.toString() === restaurantId) {
              const createUser = await Users.create({
                restaurants: restaurantId,
                fullName,
                username,
                password,
                avatar,
                email: isReport ? emailReport : '',
                role: isRole.role,
              });

              if (newEmail.emailScan) {
                const createEmailReceive = await Emails.create({
                  restaurant: restaurantId,
                  email: emailScan,
                  type: EMAIL_STATUS.RECEIVE,
                  user: createUser._id,
                });
              }

              if (newEmail.emailReport) {
                const createEmailReport = await Emails.create({
                  restaurant: restaurantId,
                  email: emailReport,
                  type: EMAIL_STATUS.REPORT,
                  user: createUser._id,
                });
              }

              return res.json(apiResponse({
                message: 'Compte créé avec succès',
              }));
            }

            return next(apiErrors.notFound);
          }),
        );
      }
    } catch (error) {
      next(error);
    }
  },
  listUser: async (req, res, next) => {
    try {
      const { id } = req.user;
      const errors = [];
      const staffByRestaurant = [];

      const userManager = await Users.findOne({ _id: id })
        .select('restaurants')
        .lean();

      if (errors.length > 0) {
        return res.status(400).json(apiError({
          message: 'Les erreurs',
          payload: errors,
        }));
      }

      await asyncForEach(userManager.restaurants, async (data) => {
        const users = await Users.find({ restaurants: data })
          .select('fullName avatar _id')
          .populate({ path: 'restaurants' });
        staffByRestaurant.push(users);
      });
      // remove user manager in array
      const staffByRestaurantShift = staffByRestaurant[0].shift();
      return res.json(apiResponse({
        message: 'Obtenir le succès des utilisateurs de la liste',
        payload: staffByRestaurant[0],
      }));
    } catch (error) {
      next(error);
    }
  },
  userDetail: async (req, res, next) => {
    try {
      const {
        params: { id },
        user: { userManager },
      } = req;
      const restaurants = [];

      if (userManager.role === LIST_ROLE.OWNER) {
        asyncForEach(userManager.restaurants, (restaurant) => {
          restaurants.push(restaurant._id);
        });

        const employeer = await Users.findOne({ _id: id, restaurants: { $in: restaurants } })
          .select('gender avatar fullName username email password restaurants role')
          .populate({ path: 'restaurants' })
          .lean();

        if (!employeer) return next(apiErrors.userNotFound);

        const emails = await Emails.find({ user: id }).lean();

        if (!emails) return next(apiErrors.emailNotFound);

        employeer.emails = emails;

        return res.json(apiResponse({
          message: 'Demande de réussite',
          payload: employeer,
        }));
      }
      return next(apiErrors.badRequest);
    } catch (error) {
      next(error);
    }
  },
  onEditUser: async (req, res, next) => {
    try {
      const {
        body: {
          fullName, username, emailScan, emailReport, restaurantId,
          acceptEmailScan, acceptEmailReport, role, password,
        },
        params: { id },
        user: { userManager },
      } = req;

      let isRestaurant = false;

      await asyncForEach(userManager.restaurants, (restaurant) => {
        if (restaurant._id.toString() === restaurantId) isRestaurant = true;
      });

      if (!isRestaurant) return next(apiErrors.badRequest);

      if (userManager.role === LIST_ROLE.OWNER) {
        const restaurants = [];
        const errors = [];
        // eslint-disable-next-line prefer-const
        let newUser = { email: '' };

        if (!fullName) {
          errors.push({
            msg: 'S\'il-vous-plaît, entrer votre prénom et votre nom',
            param: 'fullName',
            location: 'body',
          });
        }

        if (!username) {
          errors.push({
            msg: 'Veuillez entrer votre nom de compte',
            param: 'username',
            location: 'body',
          });
        }

        if (!password) {
          errors.push({
            msg: 'S\'il vous plait entrez votre mot de passe',
            param: 'password',
            location: 'body',
          });
        }

        if (!acceptEmailScan || !emailScan) {
          await Emails.findOneAndDelete({
            user: id, type: EMAIL_STATUS.RECEIVE,
          });
        }

        if (!acceptEmailReport || !emailReport) {
          await Emails.findOneAndDelete({
            user: id, type: EMAIL_STATUS.REPORT,
          });
        }

        if (acceptEmailScan && emailScan) {
          if (validateEmail(emailScan)) {
            const checkEmail = await Emails.findOne({
              email: emailScan,
              type: EMAIL_STATUS.RECEIVE,
            }).lean();

            if (checkEmail) {
              if (checkEmail.user.toString() !== id) {
                errors.push({
                  msg: 'L\'email reçu BL existe déjà',
                  location: 'body',
                  param: 'emailScan',
                });
              }
            } else {
              await Emails.findOneAndDelete({
                user: id, type: EMAIL_STATUS.RECEIVE,
              });
              await Emails.create({
                user: id,
                email: emailScan,
                type: EMAIL_STATUS.RECEIVE,
              });
            }
          } else {
            errors.push({
              msg: 'Veuillez saisir le format d\'e - mail correct',
              param: 'emailScan',
              location: 'body',
            });
          }
        }

        if (acceptEmailReport && emailReport) {
          if (validateEmail(emailReport)) {
            const checkEmail = await Emails.findOne({
              email: emailReport,
              type: EMAIL_STATUS.REPORT,
            }).lean();

            if (checkEmail) {
              if (checkEmail.user.toString() !== id) {
                errors.push({
                  msg: 'L\'email pour recevoir le rapport existe déjà',
                  location: 'body',
                  param: 'emailReport',
                });
              }
              newUser.email = emailReport;
            } else {
              await Emails.findOneAndDelete({
                user: id, type: EMAIL_STATUS.REPORT,
              });
              await Emails.create({
                user: id,
                email: emailReport,
                type: EMAIL_STATUS.REPORT,
              });
              newUser.email = emailReport;
            }
          } else {
            errors.push({
              msg: 'Veuillez saisir le format d\'e - mail correct',
              location: 'body',
              param: 'emailReport',
            });
          }
        }

        if (errors.length > 0) {
          return res.status(400).json(apiError({
            message: 'Les erreurs',
            errors,
          }));
        }

        await asyncForEach(userManager.restaurants, async (restaurant) => {
          restaurants.push(restaurant._id);
        });

        const editUser = await Users.findOne({ _id: id, restaurants: { $in: restaurants } })
          .populate({ path: 'restaurants' })
          .lean();

        if (!editUser) return next(apiErrors.notFound);

        const checkUsername = await Users.findOne({ username }).lean();

        if (checkUsername) {
          // eslint-disable-next-line max-len
          if (editUser._id.toString() !== checkUsername._id.toString()) return next(apiErrors.usernameExists);
        }

        switch (role) {
          case LIST_ROLE.MANAGER:
            newUser.role = LIST_ROLE.MANAGER;
            break;
          case LIST_ROLE.EMPLOYEER:
            newUser.role = LIST_ROLE.EMPLOYEER;
            break;
          default:
            break;
        }

        if (req.file) {
          newUser.avatar = req.file.transforms[0].location;
        }

        newUser.fullName = fullName;
        newUser.username = username;
        newUser.password = password;

        await Users.findByIdAndUpdate(id, { $set: { ...newUser } });

        return res.json(apiResponse({
          message: 'Mise à jour réussie!',
        }));
      }
      return next(apiErrors.badRequest);
    } catch (error) {
      next(error);
    }
  },
  getProfile: async (req, res, next) => {
    try {
      const { id } = req.user;

      const user = await Users.findById(id)
        .populate({ path: 'restaurants', select: 'restaurantName address' })
        .select('restaurants role gender avatar fullName phoneNumber email username password')
        .lean();

      if (!user) return next(apiErrors.notFound);

      return res.json(apiResponse({
        message: 'obtenir le succès du profil',
        payload: user,
      }));
    } catch (error) {
      next(error);
    }
  },
  onEditProfile: async (req, res, next) => {
    try {
      const {
        user: { id },
        body: {
          fullName, phoneNumber, password,
          email, username,
        },
      } = req;
      const errors = [];
      const newUser = {};

      if (!fullName) {
        errors.push({
          msg: 'S\'il-vous-plaît, entrer votre prénom et votre nom!',
          param: 'fullName',
          location: 'body',
        });
      }

      if (!username) {
        errors.push({
          msg: 'Veuillez entrer votre nom de compte',
          param: 'username',
          location: 'body',
        });
      }

      if (!phoneNumber) {
        errors.push({
          msg: 'le numéro de téléphone est requis',
          param: 'phoneNumber',
          location: 'body',
        });
      }
      if (!email) {
        errors.push({
          msg: 'L\'e-mail est requis',
          param: 'email',
          location: 'body',
        });
      }
      if (!password) {
        errors.push({
          msg: 'S\'il vous plait entrez votre mot de passe',
          param: 'password',
          location: 'body',
        });
      }

      if (!regexPhoneNumber(phoneNumber)) {
        errors.push({
          msg: 'Veuillez saisir le bon format de numéro de téléphone',
          param: 'phoneNumber',
          location: 'body',
        });
      }

      if (!validateEmail(email)) {
        errors.push({
          body: 'email',
          msg: 'Veuillez saisir le bon format d\'e-mail',
          params: 'email',
        });
      }

      if (errors.length) {
        return res.status(404).json({
          message: 'Pas trouvé',
          payload: errors,
        });
      }

      const user = await Users.findById(id).lean();

      if (!user) return next(apiErrors.notFound);

      const checkUsername = await Users.findOne({ username }).lean();
      if (!checkUsername) newUser.username = username;

      compareResult(checkUsername, user, () => {
        errors.push({
          value: username,
          msg: 'Ce nom d\'utilisateur existe déjà',
          param: 'username',
          location: 'body',
        });
      });

      const checkEmail = await Users.findOne({ email }).lean();
      if (!checkEmail) {
        newUser.email = email;
        await Emails.deleteMany({ user: user._id });
        await Emails.create([
          {
            restaurant: user,
            user: user._id,
            email,
            type: EMAIL_STATUS.RECEIVE,
          },
          {
            user: user._id,
            email,
            type: EMAIL_STATUS.REPORT,
          },
        ]);
      }

      compareResult(checkEmail, user, () => {
        errors.push({
          value: email,
          msg: 'l\'email existe déjà',
          param: 'email',
          location: 'body',
        });
      });

      const checkPhoneNumber = await Users.findOne({ phoneNumber }).lean();
      if (!checkPhoneNumber) newUser.phoneNumber = phoneNumber;

      compareResult(checkPhoneNumber, user, () => {
        errors.push({
          value: phoneNumber,
          msg: 'Le numéro de téléphone existe déjà!',
          param: 'phoneNumber',
          location: 'body',
        });
      });

      if (errors.length > 0) {
        return res.status(409).json(apiError({
          message: 'les erreurs',
          errors,
        }));
      }

      newUser.fullName = fullName;
      newUser.phoneNumber = phoneNumber;

      if (user.role !== LIST_ROLE.OWNER) return next(apiErrors.notFound);

      if (user.role === LIST_ROLE.OWNER) {
        if (user.password !== password) {
          const salt = await bcrypt.genSalt(10);
          const hashPassword = await bcrypt.hash(password, salt);
          newUser.password = hashPassword;
        }
      } else if (password !== user.password) {
        newUser.password = password;
      }

      if (req.file) {
        newUser.avatar = req.file.transforms[0].location;
      }

      await Users.findByIdAndUpdate(id, { $set: { ...newUser } });

      return res.json(apiResponse({
        message: 'Mise à jour réussie !',
      }));
    } catch (error) {
      next(error);
    }
  },
  deleteUser: async (req, res, next) => {
    try {
      const {
        params: { id },
        user: { id: userId },
      } = req;
      const restaurants = [];
      const isOwner = await Users.findById(userId)
        .select('restaurants role')
        .lean();

      if (!isOwner) return next(apiErrors.badRequest);
      if (isOwner.role !== LIST_ROLE.OWNER) return next(apiErrors.badRequest);

      await asyncForEach(isOwner.restaurants, (restaurant) => {
        restaurants.push(restaurant);
      });

      const employeer = await Users.findOne({
        _id: id,
        restaurants: { $in: restaurants },
      }).select('_id role').lean();

      if (!employeer) return next(apiErrors.notFound);
      if (employeer.role === LIST_ROLE.OWNER) return next(apiErrors.badRequest);

      await Emails.deleteMany({ user: id });
      await Users.deleteOne({ _id: id });

      return res.json(apiResponse({
        message: 'Suppression du compte réussie !',
      }));
    } catch (error) {
      next(error);
    }
  },
  // stop here
  // getInfomation: async (req, res, next) => {
  //   try {
  //     const {
  //       user: { id },
  //       body: {
  //         email, addtionalInfomation, lastReport,
  //         annualRevenue, weeklyInventory, timeForReception,
  //       },
  //     } = req;

  //     const user = await Users.findById(id).lean();
  //     if (user.role !== LIST_ROLE.OWNER) return next(apiErrors.badRequest);
  //   } catch (error) {
  //     next(error);
  //   }
  // },
};
