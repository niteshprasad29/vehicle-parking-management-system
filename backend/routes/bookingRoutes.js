import express from 'express';
import {
  createBooking,
  getBookings,
  getBookingById,
  cancelBooking,
  rescheduleBooking,
  searchBooking,
  recordEntry,
  recordExit,
} from '../controllers/bookingController.js';
import { protect } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/roleMiddleware.js';

const router = express.Router();

router.post('/', protect, authorize('USER', 'ADMIN'), createBooking);
router.get('/', protect, getBookings);
router.get('/search', protect, authorize('STAFF', 'ADMIN'), searchBooking);
router.get('/:id', protect, getBookingById);
router.patch('/:id/reschedule', protect, rescheduleBooking);
router.post('/:id/cancel', protect, cancelBooking);
router.post('/:id/entry', protect, authorize('STAFF', 'ADMIN'), recordEntry);
router.post('/:id/exit', protect, authorize('STAFF', 'ADMIN'), recordExit);

export default router;
