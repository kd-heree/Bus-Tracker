const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const usersPath = path.join(__dirname, 'backend', 'data', 'users.json');

const hashedPassword = bcrypt.hashSync('1234', 10);

const adminUser = {
    id: "USR-ADMIN",
    name: "System Admin",
    email: "admin@gmail.com",
    password: hashedPassword,
    role: "admin"
};

fs.writeFileSync(usersPath, JSON.stringify([adminUser], null, 4));
console.log("Admin user reset successfully with hash:", hashedPassword);
