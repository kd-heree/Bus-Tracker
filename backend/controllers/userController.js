const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const usersPath = path.join(__dirname, '../data/users.json');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const getUsers = () => JSON.parse(fs.readFileSync(usersPath, 'utf8'));
const saveUsers = (data) => fs.writeFileSync(usersPath, JSON.stringify(data, null, 4));

const generateToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, { expiresIn: '1h' });
};

exports.signupUser = (req, res) => {
    const { name, email, password } = req.body;
    const users = getUsers();
    
    // Prevent duplicate email
    if (users.find(u => u.email === email)) {
        return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    
    // Hash password securely
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);
    
    const newUser = {
        id: "USR-" + Math.floor(100000 + Math.random() * 900000),
        name,
        email,
        password: hashedPassword,
        role: "user" // Defaults to normal user
    };
    
    users.push(newUser);
    saveUsers(users);
    
    // Return sanitized instance with JWT
    const { password: _, ...safeUser } = newUser;
    const token = generateToken(safeUser.id);
    
    res.json({ success: true, user: safeUser, token, message: "Registration successful" });
};

exports.loginUser = (req, res) => {
    const { email, password } = req.body;
    const users = getUsers();
    
    const user = users.find(u => u.email === email);
    
    if (user && bcrypt.compareSync(password, user.password)) {
        // Safe dispatch omitting password
        const { password: _, ...safeUser } = user;
        const token = generateToken(user.id);
        res.json({ success: true, user: safeUser, token });
    } else {
        res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
};

exports.getUserProfile = (req, res) => {
    // Relying on req.user assigned by authMiddleware
    res.json({ success: true, user: req.user });
};

exports.getAllUsers = (req, res) => {
    // Admin only functionality protecting user catalog
    const users = getUsers();
    const safeUsers = users.map(({ password, ...u }) => u);
    res.json({ success: true, users: safeUsers });
};

exports.deleteUser = (req, res) => {
    const { userId } = req.params;
    
    // Prevent self-deletion
    if (req.user.id === userId) {
        return res.status(400).json({ success: false, message: "Cannot delete your own admin account while active" });
    }
    
    // 1. Delete the user
    let users = getUsers();
    const initialUsersLength = users.length;
    users = users.filter(u => u.id !== userId);
    
    if (users.length === initialUsersLength) {
        return res.status(404).json({ success: false, message: "User not found" });
    }
    saveUsers(users);

    // 2. Cascade delete bookings
    const bookingsPath = path.join(__dirname, '../data/bookings.json');
    if (fs.existsSync(bookingsPath)) {
        let bookings = JSON.parse(fs.readFileSync(bookingsPath, 'utf8'));
        const activeBookingsLength = bookings.length;
        bookings = bookings.filter(b => b.userId !== userId);
        if(bookings.length !== activeBookingsLength) {
            fs.writeFileSync(bookingsPath, JSON.stringify(bookings, null, 4));
        }
    }
    
    res.json({ success: true, message: "User securely erased" });
};
