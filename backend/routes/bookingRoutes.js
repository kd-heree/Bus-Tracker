const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { protect, adminOnly } = require('../middleware/authMiddleware');

router.post('/create', protect, bookingController.createBooking);
router.get('/user/:userId', protect, bookingController.getUserBookings);
router.get('/bus/:busId', protect, bookingController.getBusBookings);
router.get('/all', protect, adminOnly, bookingController.getAllBookings);
router.delete('/cancel/:bookingId', protect, bookingController.cancelBooking);

module.exports = router;
