const jwt = require('jsonwebtoken');
const redisClient = require('../redis');
require('dotenv').config();

const SECRET_KEY = process.env.JWT_SECRET ;

const authenticateToken = async (req, res, next) => {
    // 1. Get token from header (Format: "Bearer <token>")
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access Denied: No Token Provided' });

    // 2. Check if token is Blacklisted (Logged out)
    const isBlacklisted = await redisClient.get(`blacklist:${token}`);
    if (isBlacklisted) return res.status(403).json({ error: 'Session Expired. Please Login Again.' });

    // 3. Verify Token
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid Token' });
        
        // Attach user info to the request object so routes can use it
        req.user = user; 
        next(); // Move to the next function (the route)
    });
};

module.exports = authenticateToken;