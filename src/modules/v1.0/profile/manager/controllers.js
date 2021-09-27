const fs = require('fs');
const request = require('request');
const {
  apiResponse,
} = require('../../../../helpers');

module.exports = {
  // draft
  convertExcelToPDF: async (req, res, next) => {
    try {
      const url = `https://pdftables.com/api?key=${process.env.KEY_PDFTABLE}&format=xlsx-single`;
      const result = request.post({ encoding: null, url }, (err, resp, body) => {
        if (!err && resp.statusCode === 200) {
          fs.writeFile('./output.xlsx', body, (error) => {
            if (error) {
              throw error;
            }
          });
        } else {
          throw error;
        }
      });

      const form = result.form();
      form.append('file', fs.createReadStream('./Commande_16-31560.pdf'));

      if (fs.existsSync('Commande_16-31560.pdf')) {
        fs.unlink('Commande_16-31560.pdf', (err) => {
          if (err) throw err;
        });
      }

      return res.json(apiResponse({
        message: 'Convertir le succès',
      }));
    } catch (error) {
      next(error);
    }
  },
};
