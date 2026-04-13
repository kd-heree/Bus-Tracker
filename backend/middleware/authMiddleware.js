const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const usersPath = path.join(__dirname, '../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key_12345';

const protect = (req, res, next) => {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    
    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized - No token provided' });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Find user by ID in DB
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
        const user = users.find(u => u.id === decoded.id);
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'Not authorized - User no longer exists' });
        }
        
        // Attach user to req without password
        const { password, ...safeUser } = user;
        req.user = safeUser;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Not authorized - Token failed validation' });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ success: false, message: 'Not authorized as an administrator' });
    }
};

module.exports = { protect, adminOnly, JWT_SECRET };
