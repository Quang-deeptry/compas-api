/* eslint-disable no-unused-expressions */
/* eslint-disable no-unneeded-ternary */
const bcrypt = require('bcryptjs');
const {
  Users,
  Restaurants,
  Emails,
} = require('../../../models');
const { generateUserToken } = require('../../../services/jwt');
const {
  apiErrors,
  apiResponse,
  apiError,
} = require('../../../helpers');
const smtpTransport = require('../../../services/nodeMailer');
const {
  LIST_ROLE,
  EMAIL_STATUS,
  LOGO,
} = require('../../../constants');

module.exports = {
  onRegister: async (req, res, next) => {
    try {
      const {
        restaurantName, email, street, accept,
        number, city, zipCode, fullName, phoneNumber, username, password,
      } = req.body;

      const errors = [];
      let convert;

      if (typeof accept === 'string' || accept === undefined) {
        convert = accept && accept === 'true' ? true : false;
      }

      const address = {
        street, number, city, zipCode,
      };

      // const checkEmail = await Users.findOne({ email });
      const checkEmail = await Emails.findOne({ email }).lean();
      const checkUserEmail = await Users.findOne({ email }).lean();

      if (checkEmail && checkUserEmail) {
        errors.push(
          {
            value: email,
            msg: 'L\'email existe déjà!',
            param: 'email',
            location: 'body',
          },
        );
      }

      const checkPhoneNumber = await Users.findOne({ phoneNumber });
      if (checkPhoneNumber) {
        errors.push(
          {
            value: phoneNumber,
            msg: 'Le numéro de téléphone existe déjà!',
            param: 'phoneNumber',
            location: 'body',
          },
        );
      }

      const checkUsername = await Users.findOne({ username });
      if (checkUsername) {
        errors.push(
          {
            value: username,
            msg: 'Ce nom d\'utilisateur existe déjà!',
            param: 'username',
            location: 'body',
          },
        );
      }

      if (errors.length > 0) {
        return res.status(400).json(apiError({
          message: 'les erreurs',
          errors,
        }));
      }

      if (!convert) {
        return next(apiErrors.checkAccept);
      }

      /// Did you check if the restaurant has the same address?
      const restaurant = await Restaurants.create({
        restaurantName,
        address,
      });

      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);

      const user = await Users.create({
        restaurants: restaurant._id,
        fullName,
        phoneNumber,
        email,
        username,
        password: hashPassword,
      });

      const emails = [
        {
          restaurant: restaurant._id,
          email,
          type: EMAIL_STATUS.RECEIVE,
          user: user._id,
        },
        {
          restaurant: restaurant._id,
          email,
          type: EMAIL_STATUS.REPORT,
          user: user._id,
        },
      ];

      const createEmail = await Emails.create(emails);

      return res.json(apiResponse({
        message: 'Inscrivez-vous Succès!',
      }));
    } catch (error) {
      next(error);
    }
  },
  onLogin: async (req, res, next) => {
    try {
      const { username, password } = req.body;
      const errors = [];
      const user = await Users.findOne({ username });

      if (!user) {
        return next(apiErrors.loginFailed);
      }

      if (user.role === LIST_ROLE.OWNER) {
        if (!user.comparePassword(password)) {
          return next(apiErrors.loginFailed);
        }

        const token = await generateUserToken(user);

        return res.json(apiResponse({
          message: 'Connecté avec succès!',
          payload: token,
        }));
      }

      if (user.password !== password) {
        return next(apiErrors.loginFailed);
      }

      const token = await generateUserToken(user);

      return res.json(apiResponse({
        message: 'Connecté avec succès!',
        payload: token,
      }));
    } catch (error) {
      next(error);
    }
  },
  onLogout: async (req, res, next) => {
    try {
      const { username, password } = req.body;
      const user = await Users.findOne({ username });

      if (!user || !user.password !== password) {
        return next(apiErrors.logoutFailed);
      }
      return res.json(apiResponse({
        message: 'Déconnexion réussie',
      }));
    } catch (error) {
      next(error);
    }
  },
  recover: async (req, res, next) => {
    try {
      const { email } = req.body;
      const user = await Users.findOne({ email });

      if (!user) return next(apiErrors.emailNotFound);

      if (user.role !== LIST_ROLE.OWNER) return next(apiErrors.userNotHavePermision);

      user.generatePasswordReset();
      const result = await user.save();

      const mailOptions = {
        to: `Réinitialiser le mot de passe <${result.email}>`,
        from: process.env.EMAIL_ADDRESS,
        subject: 'Demander un changement de mot de passe',
        html: `<html lang="en-US">

          <head>
              <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
              <title>Modèle d'e-mail de réinitialisation du mot de passe</title>
              <meta name="description" content="Modèle d'e-mail de réinitialisation du mot de passe.">
              <style type="text/css">
                  a:hover {text-decoration: underline !important;}
              </style>
          </head>

          <body marginheight="0" topmargin="0" marginwidth="0" style="margin: 0px; background-color: #f2f3f8;" leftmargin="0">
              <!--100% body table-->
              <table cellspacing="0" border="0" cellpadding="0" width="100%" bgcolor="#f2f3f8"
                  style="@import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700); font-family: 'Open Sans', sans-serif;">
                  <tr>
                      <td>
                          <table style="background-color: #f2f3f8; max-width:670px;  margin:0 auto;" width="100%" border="0"
                              align="center" cellpadding="0" cellspacing="0">
                              <tr>
                                  <td style="height:80px;">&nbsp;</td>
                              </tr>
                              <tr>
                                  <td style="height:20px;">&nbsp;</td>
                              </tr>
                              <tr>
                                  <td>
                                      <table width="95%" border="0" align="center" cellpadding="0" cellspacing="0"
                                          style="max-width:670px;background:#fff; border-radius:3px; text-align:center;-webkit-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);-moz-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);box-shadow:0 6px 18px 0 rgba(0,0,0,.06);">
                                          <tr>
                                              <td style="height:40px;">&nbsp;</td>
                                          </tr>
                                          <tr>
                                              <td style="padding:0 35px;">
                                                  <h1 style="color:#1e1e2d; font-weight:500; margin:0;font-size:32px;font-family:'Rubik',sans-serif;">Vous avez demandé la réinitialisation de votre mot de passe</h1>
                                                  <span
                                                      style="display:inline-block; vertical-align:middle; margin:29px 0 26px; border-bottom:1px solid #cecece; width:100px;"></span>
                                                  <p style="color:#455056; font-size:15px;line-height:24px; margin:0;">
                                                      Bonjour ${result.username}, voici votre code de vérification.
                                                  </p>
                                                  <p href=""
                                                      style="background:#20e277;text-decoration:none !important; font-weight:500; margin-top:35px; color:#fff; font-size:36px;padding:10px 24px;display:inline-block;">${result.resetPasswordCode}</p>
                                              </td>
                                          </tr>
                                          <tr>
                                              <td style="height:40px;">&nbsp;</td>
                                          </tr>
                                      </table>
                                  </td>
                          </table>
                      </td>
                  </tr>
              </table>
              <!--/100% body table-->
          </body>
        </html>`,
      };
      await smtpTransport.sendMail(mailOptions);
      return res.json(apiResponse({
        message: 'Un e-mail de réinitialisation a été envoyé à votre adresse e-mail. Veuillez vérifier votre boîte de réception, y compris le dossier spam.',
        payload: result._id,
      }));
    } catch (error) {
      next(error);
    }
  },
  validationCode: async (req, res, next) => {
    try {
      const user = await Users.findOne(
        {
          _id: req.body.userId,
          resetPasswordCode: req.body.resetPasswordCode,
          resetPasswordExpires: { $gt: Date.now() },
        },
      );

      if (!user) return next(apiErrors.tokenResetPasswordNotFound);

      return res.json(apiResponse({
        message: 'Le code est correct',
        payload: user,
      }));
    } catch (error) {
      next(error);
    }
  },
  resetPassword: async (req, res, next) => {
    try {
      const { password, userId } = req.body;
      const user = await Users.findOne(
        {
          _id: userId,
        },
      );
      if (!user) return next(apiErrors.userNotFound);

      const salt = await bcrypt.genSalt(10);
      const hashPassword = await bcrypt.hash(password, salt);

      user.password = hashPassword;
      user.resetPasswordCode = undefined;
      user.resetPasswordExpires = undefined;
      const result = await user.save();
      const mailOptions = {
        to: `Réinitialiser le mot de passe <${result.email}>`,
        from: process.env.EMAIL_ADDRESS,
        subject: 'Votre mot de passe a été changé',
        html: `<html lang="en-US">
          <head>
              <meta content="text/html; charset=utf-8" http-equiv="Content-Type" />
              <title>Modèle d'e-mail de réinitialisation du mot de passe</title>
              <meta name="description" content="Modèle d'e-mail de réinitialisation du mot de passe.">
              <style type="text/css">
                  a:hover {text-decoration: underline !important;}
              </style>
          </head>

          <body marginheight="0" topmargin="0" marginwidth="0" style="margin: 0px; background-color: #f2f3f8;" leftmargin="0">
              <!--100% body table-->
              <table cellspacing="0" border="0" cellpadding="0" width="100%" bgcolor="#f2f3f8"
                  style="@import url(https://fonts.googleapis.com/css?family=Rubik:300,400,500,700|Open+Sans:300,400,600,700); font-family: 'Open Sans', sans-serif;">
                  <tr>
                      <td>
                          <table style="background-color: #f2f3f8; max-width:670px;  margin:0 auto;" width="100%" border="0"
                              align="center" cellpadding="0" cellspacing="0">
                              <tr>
                                  <td style="height:80px;">&nbsp;</td>
                              </tr>
                              <tr>
                                  <td style="height:20px;">&nbsp;</td>
                              </tr>
                              <tr>
                                  <td>
                                      <table width="95%" border="0" align="center" cellpadding="0" cellspacing="0"
                                          style="max-width:670px;background:#fff; border-radius:3px; text-align:center;-webkit-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);-moz-box-shadow:0 6px 18px 0 rgba(0,0,0,.06);box-shadow:0 6px 18px 0 rgba(0,0,0,.06);">
                                          <tr>
                                              <td style="height:40px;">&nbsp;</td>
                                          </tr>
                                          <tr>
                                              <td style="padding:0 35px;">
                                                  <h1 style="color:#1e1e2d; font-weight:500; margin:0;font-size:32px;font-family:'Rubik',sans-serif;">Le mot de passe de votre compte vient d'être modifié.</h1>
                                                  <span
                                                      style="display:inline-block; vertical-align:middle; margin:29px 0 26px; border-bottom:1px solid #cecece; width:100px;"></span>
                                              </td>
                                          </tr>
                                          <tr>
                                              <td style="height:40px;">&nbsp;</td>
                                          </tr>
                                      </table>
                                  </td>
                          </table>
                      </td>
                  </tr>
              </table>
              <!--/100% body table-->
          </body>
        </html>`,
      };

      smtpTransport.sendMail(mailOptions, (error, respon) => {
        if (error) return res.status(500).json({ payload: error });
        return res.json(apiResponse({
          message: 'Votre mot de passe a été mis à jour.',
        }));
      });
    } catch (error) {
      next(error);
    }
  },
  changePassword: async (req, res, next) => {
    try {
      const { password, newPassword } = req.body;

      const user = await Users.findOne({ _id: req.user.id }).lean();

      if (user.role === LIST_ROLE.OWNER) {
        const compare = bcrypt.compareSync(password, user.password);
        const compareNewPassword = bcrypt.compareSync(newPassword, user.password);

        if (!compare) {
          return next(apiErrors.comparePasswordFailed);
        }

        if (compareNewPassword) {
          return next(apiErrors.compareNewPassword);
        }

        const salt = await bcrypt.genSalt(10);
        const hashPassword = await bcrypt.hash(newPassword, salt);

        await Users.findByIdAndUpdate(user._id, {
          password: hashPassword,
        });

        return res.json(apiResponse({
          message: 'Changement de mot de passe réussi',
        }));
      }

      if (user.role === LIST_ROLE.MANAGER || user.role === LIST_ROLE.EMPLOYEER) {
        if (!user.password !== password) {
          return next(apiErrors.comparePasswordFailed);
        }

        await Users.findByIdAndUpdate(user._id, {
          password: newPassword,
        });

        return res.json(apiResponse({
          message: 'Changement de mot de passe réussi',
        }));
      }
    } catch (error) {
      next(error);
    }
  },
};
