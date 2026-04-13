const express = require('express');
const router = express.Router();
const busController = require('../controllers/busController');
const { protect } = require('../middleware/authMiddleware');

router.get('/available', protect, busController.getAllBuses);
router.get('/search-routes', protect, busController.searchRoutes);
router.post('/create', protect, busController.createBus);
router.get('/:busId', protect, busController.getBusById);
router.put('/:busId', protect, busController.updateBus);
router.delete('/:busId', protect, busController.deleteBus);

module.exports = router;
