const router = require('express').Router();

const { convertExcelToPDF } = require('./controllers');

router.post('/convert', convertExcelToPDF);

module.exports = router;
