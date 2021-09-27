const jwt = require('jsonwebtoken');

const { promisify } = require('util');

const verify = promisify(jwt.verify);

module.exports = {
  verifyToken: (token) => verify(token, process.env.JWT_SECRET),

  generateUserToken: (user) => jwt.sign(
    {
      id: user._id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE },
  ),

  decodedToken: (token) => jwt.decode(token),
};
