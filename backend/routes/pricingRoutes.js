import express from 'express';
import {
  getPricingRules,
  createPricingRule,
  updatePricingRule,
} from '../controllers/pricingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.get('/', getPricingRules);
router.post('/', protect, authorize('ADMIN'), createPricingRule);
router.put('/:id', protect, authorize('ADMIN'), updatePricingRule);

export default router;
