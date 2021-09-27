const aws = require('aws-sdk');
const multerS3 = require('multer-s3-transform');
const sharp = require('sharp');
const multer = require('multer');

aws.config.update({
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  region: process.env.AWS_REGION_CODE,
});

const s3 = new aws.S3();

const storage = multerS3({
  s3,
  bucket: process.env.AWS_BUCKET,
  acl: 'public-read',
  cacheControl: 'max-age=31536000',
  shouldTransform: (req, file, cb) => {
    cb(null, /^image/i.test(file.mimetype));
  },
  transforms: [{
    id: 'original',
    key: (req, file, cb) => {
      const token = Math.random().toString(36).substr(7);
      const filename = file.originalname;
      const fileExtension = filename.split('.').reverse()[0].toLowerCase();

      const now = new Date();

      const uploadFileName = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getTime() + token}.${fileExtension}`;

      cb(null, uploadFileName);
    },
    transform: (req, file, cb) => {
      let transform = sharp();

      const rotateStates = {
        LEFT: '6',
      };

      // This fix for Android
      if (req.body.orientation === rotateStates.LEFT) {
        transform = transform.rotate(90);
      }

      cb(null, transform);
    },
  }],
});

const limits = {
  fileSize: 15 * 1024 * 1024,
};

function fileFilter(req, file, cb) {
  const arr = ['image/png', 'image/jpeg'];
  if (arr.indexOf(file.mimetype) === -1) {
    return cb('Fichier non valide');
  }

  return cb(null, true);
}

const upload = multer({ storage, fileFilter, limits });

module.exports = { upload, s3 };
