const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/signup', userController.signupUser);
router.post('/login', userController.loginUser);
router.get('/profile/:userId', protect, userController.getUserProfile);
router.get('/', protect, adminOnly, userController.getAllUsers);
router.delete('/:userId', protect, adminOnly, userController.deleteUser);

module.exports = router;
