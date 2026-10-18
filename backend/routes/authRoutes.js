import express from 'express';
import {
  register,
  login,
  getMe,
  updateProfile,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateRegisterInput,
  validateLoginInput,
  validateProfileUpdateInput,
} from '../validators/authValidators.js';

const router = express.Router();

// Public routes
router.post('/register', validate(validateRegisterInput), register);
router.post('/login', validate(validateLoginInput), login);

// Protected routes (Requires valid JWT)
router.get('/me', protect, getMe);
router.put('/profile', protect, validate(validateProfileUpdateInput), updateProfile);

// Role authorization verification endpoints
router.get('/staff-only', protect, authorize('STAFF', 'ADMIN'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Staff access granted.',
    data: { user: req.user.name, role: req.user.role },
  });
});

router.get('/admin-only', protect, authorize('ADMIN'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin access granted.',
    data: { user: req.user.name, role: req.user.role },
  });
});

export default router;
