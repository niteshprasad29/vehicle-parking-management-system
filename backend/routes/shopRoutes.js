import express from 'express';
import { createShopOrder, getShopOrders, getShopProducts } from '../controllers/shopController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/products', getShopProducts);
router.get('/orders', protect, authorize('USER', 'ADMIN'), getShopOrders);
router.post('/orders', protect, authorize('USER', 'ADMIN'), createShopOrder);

export default router;