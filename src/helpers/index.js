const crypto = require('crypto');
const { validationResult } = require('express-validator');

const apiErrors = require('./apiErrors');

module.exports = {
  genCryptoToken: (size = 20) => (
    new Promise((resolve, reject) => {
      crypto.randomBytes(size, (err, buf) => {
        if (err) reject(err);

        const token = buf.toString('hex');

        resolve(token);
      });
    })
  ),

  checkValidateErrors: (req) => {
    const errors = validationResult(req);

    if (errors.isEmpty()) return false;

    return errors;
  },

  validateEmail: (email) => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  },

  asyncForEach: async (array, callback) => {
    for (let index = 0; index < array.length; index += 1) {
      await callback(array[index], index, array); // eslint-disable-line
    }
  },

  changeStringToNumber: (text) => {
    const regex = new RegExp(/,/gm);
    const newText = regex.test(text) ? Number(text.replace(',', '.')) : Number(text);
    return newText;
  },

  regexPhoneNumber: (phone) => {
    const regex = new RegExp(/^((\+)33)[1-9](\d{2}){4}$/g);
    if (!regex.test(phone)) return false;
    return true;
  },

  apiResponse: (obj = {}, message = 'Succès') => ({
    status: 200,
    code: 200,
    message,
    payload: null,
    ...obj,
  }),

  apiError: (obj = {}, message = 'les erreurs') => ({
    status: 400,
    code: 4001,
    message,
    errors: null,
    ...obj,
  }),

  compareResult: (dataExists, data1, callback) => {
    const errors = [];
    if (dataExists) {
      if (data1._id.toString() !== dataExists._id.toString()) {
        return callback();
      }
    }
  },

  fuzzySearch: (text) => {
    const regex = text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    return new RegExp(regex, 'gi');
  },

  matchRoundPrice: (price) => Math.round((price + Number.EPSILON) * 100) / 100,

  countPerPage: (no, currentPage, perPage = 20) => perPage * (currentPage - 1) + 1 + no,

  shortenText: (text) => `${text.replace(/^(.{39}[^\\s]*).*/, '$1')}${text.length > 39 ? '...' : ''}`,

  apiErrors,

  // eslint-disable-next-line max-len
  generateCodeNumber: (min = 1000, max = 9999) => Math.floor(Math.random() * (Math.floor(max) - Math.ceil(min) + 1)) + Math.ceil(min),

  checkNumberOfCodes: (numOfCode, quantity) => {
    const result = quantity % numOfCode;
    if (quantity > numOfCode && result === 0) {
      return true;
    }
    return false;
  },

  currencyFormat: (number) => {
    const value = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(number);
    return value;
  },

  numberFormat: (number) => {
    const value = new Intl.NumberFormat('de-DE').format((number));
    return value;
  },

  getEmail: (data) => {
    let email = '';
    data.forEach((item) => {
      if (item.includes('Email')) {
        const emailArr = item.split(' ');
        email = emailArr[emailArr.length - 1];
      }
    });
    return email;
  },

  countNumberOfCodes: async (converter, quantity) => {
    const number = (converter * quantity) < 0.5 ? 1 : (converter * quantity).toFixed(0);
    return number;
  },

  countQuantity: async (quantity, codes) => {
    // const number = (quantity / codes) > 1 ? (quantity / codes) : 1;
    const number = (quantity / codes).toFixed(3);
    return number;
  },

  delay: async (time, v) => new Promise((resolve) => {
    setTimeout(resolve.bind(null, v), time);
  }),

};
