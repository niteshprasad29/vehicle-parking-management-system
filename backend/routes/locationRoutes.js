import express from 'express';
import {
  createLocation,
  getLocations,
  getLocationById,
  updateLocation,
  deleteLocation,
} from '../controllers/locationController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateLocationInput,
  validateLocationUpdateInput,
} from '../validators/locationValidators.js';

const router = express.Router();

// Public routes
router.get('/', getLocations);
router.get('/:id', getLocationById);

// Admin-only routes
router.post(
  '/',
  protect,
  authorize('ADMIN'),
  validate(validateLocationInput),
  createLocation
);
router.put(
  '/:id',
  protect,
  authorize('ADMIN'),
  validate(validateLocationUpdateInput),
  updateLocation
);
router.delete('/:id', protect, authorize('ADMIN'), deleteLocation);

export default router;
