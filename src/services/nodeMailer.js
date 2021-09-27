const nodemailer = require('nodemailer');

const smtpTransport = nodemailer.createTransport({
  service: 'Gmail',
  secure: true,
  headers: {
    'Content-type': 'image/svg+xml',
  },
  auth: {
    user: process.env.EMAIL_ADDRESS,
    pass: process.env.EMAIL_PASSWORD,
  },
});
module.exports = smtpTransport;
