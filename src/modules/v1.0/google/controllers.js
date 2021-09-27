/* eslint-disable camelcase */
const fs = require('fs');
const { google } = require('googleapis');

const {
  apiResponse,
  apiError,
  apiErrors,
} = require('../../../helpers');

const TOKEN_PATH = 'token.json';

module.exports = {
  googleAuthCallback: (req, res, next) => {
    try {
      const { code } = req.query;
      if (!code) return next(apiErrors.notFound);

      fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log(`credentials Error: ${err}`);
        const credentials = JSON.parse(content);
        const { client_id, client_secret, redirect_uris } = credentials.web;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        oAuth2Client.getToken(code, (error, token) => {
          if (error) {
            return res.json(apiError({
              message: 'Erreur lors de la récupération du jeton d\'accès',
              errors: error,
            }));
          }

          oAuth2Client.setCredentials(token);
          fs.writeFile(TOKEN_PATH, JSON.stringify(token), (er) => {
            if (er) {
              return res.json(apiError({
                message: 'Le jeton enregistré échoue',
                errors: er,
              }));
            }
          });
        });
      });

      return res.json(apiResponse({
        message: 'Obtenez le code avec succès mã',
        payload: code,
      }));
    } catch (error) {
      next(error);
    }
  },
};
