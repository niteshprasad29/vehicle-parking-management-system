import express from 'express';
import {
  createSlot,
  getSlots,
  getSlotById,
  updateSlot,
  deleteSlot,
} from '../controllers/slotController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateSlotInput,
  validateSlotUpdateInput,
} from '../validators/slotValidators.js';

const router = express.Router();

// Public routes
router.get('/', getSlots);
router.get('/:id', getSlotById);

// Admin-only routes
router.post(
  '/',
  protect,
  authorize('ADMIN'),
  validate(validateSlotInput),
  createSlot
);
router.put(
  '/:id',
  protect,
  authorize('ADMIN'),
  validate(validateSlotUpdateInput),
  updateSlot
);
router.delete('/:id', protect, authorize('ADMIN'), deleteSlot);

export default router;
