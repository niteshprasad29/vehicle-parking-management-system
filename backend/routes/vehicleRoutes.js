import express from 'express';
import {
  createVehicle,
  getVehicles,
  getVehicleById,
  updateVehicle,
  deleteVehicle,
} from '../controllers/vehicleController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateVehicleInput,
  validateVehicleUpdateInput,
} from '../validators/vehicleValidators.js';

const router = express.Router();

// All vehicle routes require authentication
router.use(protect);

router
  .route('/')
  .post(authorize('USER', 'ADMIN'), validate(validateVehicleInput), createVehicle)
  .get(authorize('USER', 'ADMIN'), getVehicles);

router
  .route('/:id')
  .get(authorize('USER', 'ADMIN'), getVehicleById)
  .put(authorize('USER', 'ADMIN'), validate(validateVehicleUpdateInput), updateVehicle)
  .delete(authorize('USER', 'ADMIN'), deleteVehicle);

export default router;
