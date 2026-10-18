import express from 'express';
import {
	createPaymentOrder,
	fallbackPaymentToCash,
	getPaymentById,
	getPaymentConfig,
	getPayments,
	startUpiPayment,
	verifyPayment,
} from '../controllers/paymentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', protect, getPayments);
router.get('/config', getPaymentConfig);
router.post('/razorpay/order', protect, authorize('USER', 'ADMIN'), createPaymentOrder);
router.post('/razorpay/verify', protect, authorize('USER', 'ADMIN'), verifyPayment);
router.patch('/:id/fallback-to-cash', protect, authorize('USER', 'ADMIN'), fallbackPaymentToCash);
router.patch('/:id/start-upi', protect, authorize('USER', 'ADMIN'), startUpiPayment);
router.get('/:id', protect, authorize('USER', 'ADMIN', 'STAFF'), getPaymentById);

export default router;
