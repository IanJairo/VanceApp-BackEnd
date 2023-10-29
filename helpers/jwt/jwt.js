
// require('dotenv').config();
const jwt = require('jsonwebtoken');
const secret = process.env.JWT_SECRET;

const verifyJWT = {
     authenticateToken(req, res, next) {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];
      
        if (!token) {
          return res.status(401).json({ error: 'Token not found' });
        }
      
        jwt.verify(token, secret, (err, decoded) => {
          if (err) {
            return res.status(403).json({ error: 'Invalid token' });
          }
      
          req.userId = decoded.userId;
          next();
        });
      }
}

module.exports = {verifyJWT};