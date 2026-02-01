const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const redisClient = require('../redis');
require('dotenv').config();
// router.use(express.json());
// router.use(cors());
const SECRET_KEY = process.env.JWT_SECRET;

// 1. SIGNUP
router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    const vpa=username +'@upi';
    try {
        // Hash the password (encrypt it)
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert into DB
        const result = await pool.query(
            'INSERT INTO users (username, vpa, balance,password) VALUES ($1, $2, 0.00,$3) RETURNING id, username, vpa',
            [username, vpa, hashedPassword]
        );
        
        
        res.status(201).json({ message: 'User created!', user: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Find user
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(400).json({ error: 'User not found' });

        const user = result.rows[0];

        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return res.status(400).json({ error: 'Invalid Password' });

        // Generate Token (Valid for 1 hour)
        const token = jwt.sign({ username: user.username, vpa: user.vpa }, SECRET_KEY, { expiresIn: '1h' });

        res.json({ message: 'Login Successful', token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. LOGOUT
router.post('/logout', async (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
        // Add token to Redis Blacklist for the remaining time (e.g., 1 hour = 3600s)
        await redisClient.set(`blacklist:${token}`, 'true', { EX: 3600 });
    }
    
    res.json({ message: 'Logged out successfully' });
});





module.exports = router;