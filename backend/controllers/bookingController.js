import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Vehicle from '../models/Vehicle.js';
import ParkingSlot from '../models/ParkingSlot.js';
import ParkingLocation from '../models/ParkingLocation.js';
import Payment from '../models/Payment.js';
import PricingRule from '../models/PricingRule.js';
import Notification from '../models/Notification.js';

const generateBookingId = () => {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `BK-${Date.now().toString().slice(-6)}-${random}`;
};

const findPricingRule = async (vehicleType) => {
  const rule = await PricingRule.findOne({
    vehicleType: vehicleType.toUpperCase(),
    isActive: true,
  });

  if (!rule) {
    throw new Error(`Pricing rule not found for vehicle type: ${vehicleType}`);
  }

  return rule;
};

const calculateEstimatedAmount = async (vehicleType, entryTime, exitTime) => {
  const start = new Date(entryTime);
  const end = new Date(exitTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('Invalid booking date/time values.');
  }

  if (end <= start) {
    throw new Error('Expected exit time must be later than expected entry time.');
  }

  const pricingRule = await findPricingRule(vehicleType);
  const durationMinutes = (end - start) / (1000 * 60);
  const hours = Math.ceil(durationMinutes / 60);

  return hours * pricingRule.pricePerHour;
};

const createNotification = async (userId, title, message, type = 'BOOKING') => {
  await Notification.create({
    userId,
    title,
    message,
    type,
    isRead: false,
  });
};

export const createBooking = async (req, res, next) => {
  try {
    const { locationId, slotId, vehicleId, expectedEntryTime, expectedExitTime } = req.body;
    const paymentMethod = String(req.body.paymentMethod || 'CASH').toUpperCase();

    if (!locationId || !slotId || !vehicleId || !expectedEntryTime || !expectedExitTime) {
      return res.status(400).json({
        success: false,
        message: 'Missing required booking information.',
        errors: ['locationId, slotId, vehicleId, expectedEntryTime and expectedExitTime are required.'],
      });
    }

    if (!['CASH', 'ONLINE', 'UPI', 'CARD'].includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Choose UPI, card, or pay in person.',
        errors: ['paymentMethod must be CASH, ONLINE, UPI, or CARD.'],
      });
    }
    if (!mongoose.Types.ObjectId.isValid(locationId) || !mongoose.Types.ObjectId.isValid(slotId) || !mongoose.Types.ObjectId.isValid(vehicleId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid MongoDB identifier provided for booking.',
        errors: ['One or more IDs are not valid ObjectIds.'],
      });
    }

    const location = await ParkingLocation.findById(locationId);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Parking location not found.',
        errors: [`Location with id '${locationId}' does not exist.`],
      });
    }

    const slot = await ParkingSlot.findById(slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Parking slot not found.',
        errors: [`Slot with id '${slotId}' does not exist.`],
      });
    }

    if (slot.locationId.toString() !== locationId) {
      return res.status(400).json({
        success: false,
        message: 'Selected slot does not belong to the chosen location.',
        errors: ['Slot and location mismatch.'],
      });
    }

    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found.',
        errors: [`Vehicle with id '${vehicleId}' does not exist.`],
      });
    }

    if (vehicle.userId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot book for another user.',
        errors: ['Vehicle ownership verification failed.'],
      });
    }

    if (slot.status !== 'AVAILABLE') {
      return res.status(409).json({
        success: false,
        message: 'Parking slot is not available for the selected time.',
        errors: [`Slot '${slot.slotNumber}' is currently ${slot.status}.`],
      });
    }

    const requestedStart = new Date(expectedEntryTime);
    const requestedEnd = new Date(expectedExitTime);

    const conflictingBooking = await Booking.findOne({
      slotId,
      status: { $in: ['CONFIRMED', 'ACTIVE', 'PENDING'] },
      expectedEntryTime: { $lt: requestedEnd },
      expectedExitTime: { $gt: requestedStart },
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        message: 'Parking slot is not available for the selected time.',
        errors: ['Another booking overlaps with the requested slot timing.'],
      });
    }

    const estimatedAmount = await calculateEstimatedAmount(vehicle.vehicleType, requestedStart, requestedEnd);
    const bookingId = generateBookingId();

    const booking = await Booking.create({
      bookingId,
      userId: req.user._id,
      customerName: req.user.name,
      customerPhone: req.user.phone,
      vehicleId,
      locationId,
      slotId,
      bookingDate: new Date(),
      expectedEntryTime: requestedStart,
      expectedExitTime: requestedEnd,
      estimatedAmount,
      finalAmount: 0,
      status: 'CONFIRMED',
    });

    slot.status = 'RESERVED';
    await slot.save();

    const payment = await Payment.create({
      bookingId: booking._id,
      userId: req.user._id,
      amount: estimatedAmount,
      paymentMethod,
      transactionReference: `PAY-${bookingId}`,
      paymentStatus: 'PENDING',
    });

    await createNotification(
      req.user._id,
      'Booking Confirmed',
      `Your parking booking ${bookingId} has been confirmed for slot ${slot.slotNumber}.`,
      'BOOKING'
    );

    const populatedBooking = await Booking.findById(booking._id)
      .populate('userId', 'name email phone')
      .populate('vehicleId', 'vehicleNumber vehicleType vehicleModel')
      .populate('locationId', 'name city state address')
      .populate('slotId', 'slotNumber status');

    res.status(201).json({
      success: true,
      message: 'Parking slot booked successfully.',
      data: {
        booking: populatedBooking,
        payment,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBookings = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;
    const query = req.user.role === 'ADMIN' ? {} : { userId: req.user._id };

    const total = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email role')
      .populate('vehicleId', 'vehicleNumber vehicleType')
      .populate('locationId', 'name city')
      .populate('slotId', 'slotNumber status');
    const paymentRecords = await Payment.find({ bookingId: { $in: bookings.map((booking) => booking._id) } })
      .select('bookingId paymentMethod paymentStatus transactionReference paidAt');
    const paymentsByBookingId = new Map(paymentRecords.map((payment) => [payment.bookingId.toString(), payment]));
    const bookingsWithPayments = bookings.map((booking) => ({
      ...booking.toObject(),
      payment: paymentsByBookingId.get(booking._id.toString()) || null,
    }));

    res.status(200).json({
      success: true,
      message: 'Bookings retrieved successfully.',
      data: { bookings: bookingsWithPayments },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const booking = await Booking.findById(id)
      .populate('userId', 'name email phone')
      .populate('vehicleId', 'vehicleNumber vehicleType vehicleModel')
      .populate('locationId', 'name city address')
      .populate('slotId', 'slotNumber status');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
        errors: [`Booking with id '${id}' does not exist.`],
      });
    }

    const isOwner = booking.userId && booking.userId._id.toString() === req.user._id.toString();
    if (req.user.role !== 'ADMIN' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to this booking.',
        errors: ['Ownership verification failed.'],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Booking details retrieved successfully.',
      data: { booking },
    });
  } catch (error) {
    next(error);
  }
};

export const rescheduleBooking = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { expectedEntryTime, expectedExitTime } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid booking identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
        errors: [`Booking with id '${id}' does not exist.`],
      });
    }

    const isOwner = booking.userId.toString() === req.user._id.toString();
    if (req.user.role !== 'ADMIN' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot reschedule this booking.',
        errors: ['Ownership verification failed.'],
      });
    }

    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be rescheduled in its current state.',
        errors: ['Only pending or confirmed bookings can be rescheduled.'],
      });
    }

    const entryTime = new Date(expectedEntryTime);
    const exitTime = new Date(expectedExitTime);
    if (
      !expectedEntryTime ||
      !expectedExitTime ||
      Number.isNaN(entryTime.getTime()) ||
      Number.isNaN(exitTime.getTime()) ||
      entryTime <= new Date() ||
      exitTime <= entryTime
    ) {
      return res.status(400).json({
        success: false,
        message: 'Choose a future entry time and a later exit time.',
        errors: ['Entry must be in the future and exit must be later than entry.'],
      });
    }

    const conflictingBooking = await Booking.findOne({
      _id: { $ne: booking._id },
      slotId: booking.slotId,
      status: { $in: ['CONFIRMED', 'ACTIVE', 'PENDING'] },
      expectedEntryTime: { $lt: exitTime },
      expectedExitTime: { $gt: entryTime },
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        message: 'The parking slot is not available for the selected time.',
        errors: ['Another booking overlaps with the requested slot timing.'],
      });
    }

    const vehicle = await Vehicle.findById(booking.vehicleId);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found.',
        errors: ['The vehicle associated with this booking no longer exists.'],
      });
    }

    booking.expectedEntryTime = entryTime;
    booking.expectedExitTime = exitTime;
    booking.estimatedAmount = await calculateEstimatedAmount(vehicle.vehicleType, entryTime, exitTime);
    await booking.save();

    const payment = await Payment.findOne({ bookingId: booking._id, paymentStatus: 'PENDING' });
    if (payment) {
      payment.amount = booking.estimatedAmount;
      await payment.save();
    }

    await createNotification(
      booking.userId,
      'Booking Rescheduled',
      `Your booking ${booking.bookingId} has been moved to a new time.`,
      'BOOKING'
    );

    const updatedBooking = await Booking.findById(booking._id)
      .populate('userId', 'name email phone')
      .populate('vehicleId', 'vehicleNumber vehicleType vehicleModel')
      .populate('locationId', 'name city state address')
      .populate('slotId', 'slotNumber status');

    res.status(200).json({
      success: true,
      message: 'Booking rescheduled successfully.',
      data: { booking: updatedBooking },
    });
  } catch (error) {
    next(error);
  }
};

export const cancelBooking = async (req, res, next) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
        errors: [`Booking with id '${id}' does not exist.`],
      });
    }

    const isOwner = booking.userId.toString() === req.user._id.toString();
    if (req.user.role !== 'ADMIN' && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot cancel this booking.',
        errors: ['Ownership verification failed.'],
      });
    }

    if (['ACTIVE', 'COMPLETED', 'CANCELLED'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be cancelled in its current state.',
        errors: ['Only confirmed or pending bookings can be cancelled.'],
      });
    }

    booking.status = 'CANCELLED';
    await booking.save();

    const slot = await ParkingSlot.findById(booking.slotId);
    if (slot) {
      slot.status = 'AVAILABLE';
      await slot.save();
    }

    await createNotification(
      booking.userId,
      'Booking Cancelled',
      `Your booking ${booking.bookingId} has been cancelled successfully.`,
      'BOOKING'
    );

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully.',
      data: { booking },
    });
  } catch (error) {
    next(error);
  }
};

export const searchBooking = async (req, res, next) => {
  try {
    const { bookingId, vehicleNumber } = req.body;

    if (!bookingId && !vehicleNumber) {
      return res.status(400).json({
        success: false,
        message: 'Booking search requires bookingId or vehicleNumber.',
        errors: ['Provide at least one search field.'],
      });
    }

    let query = {};

    if (bookingId) {
      query.bookingId = bookingId.trim();
    }

    if (vehicleNumber) {
      const vehicle = await Vehicle.findOne({
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
      });
      if (!vehicle) {
        return res.status(404).json({
          success: false,
          message: 'Vehicle not found.',
          errors: [`No vehicle registered with plate '${vehicleNumber}'.`],
        });
      }
      query.vehicleId = vehicle._id;
    }

    const booking = await Booking.findOne(query)
      .populate('userId', 'name email phone')
      .populate('vehicleId', 'vehicleNumber vehicleType')
      .populate('locationId', 'name city')
      .populate('slotId', 'slotNumber status');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
        errors: ['No booking matches the provided search criteria.'],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Booking search successful.',
      data: { booking },
    });
  } catch (error) {
    next(error);
  }
};

export const recordEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actualEntryTime } = req.body;

    const booking = await Booking.findById(id).populate('slotId');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
        errors: [`Booking with id '${id}' does not exist.`],
      });
    }

    if (['COMPLETED', 'CANCELLED'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Booking cannot be activated in its current state.',
        errors: ['Only active or confirmed bookings can be checked in.'],
      });
    }

    const entryTime = actualEntryTime ? new Date(actualEntryTime) : new Date();
    booking.actualEntryTime = entryTime;
    booking.status = 'ACTIVE';
    await booking.save();

    const slot = await ParkingSlot.findById(booking.slotId._id || booking.slotId);
    if (slot) {
      slot.status = 'OCCUPIED';
      await slot.save();
    }

    await createNotification(
      booking.userId,
      'Vehicle Checked In',
      `Your vehicle has entered the parking lot. Booking ${booking.bookingId} is active.`,
      'SECURITY'
    );

    res.status(200).json({
      success: true,
      message: 'Vehicle entry recorded successfully.',
      data: { booking },
    });
  } catch (error) {
    next(error);
  }
};

export const recordExit = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { actualExitTime, paymentMethod = 'CASH' } = req.body;

    const booking = await Booking.findById(id).populate('slotId');
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found.',
        errors: [`Booking with id '${id}' does not exist.`],
      });
    }

    if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'This booking has already been completed or cancelled.',
        errors: ['Exit processing is not allowed for this booking state.'],
      });
    }

    const exitTime = actualExitTime ? new Date(actualExitTime) : new Date();

    if (!booking.actualEntryTime) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle must have a valid entry time before exit processing.',
        errors: ['Actual entry time is missing.'],
      });
    }

    const vehicleType = (await Vehicle.findById(booking.vehicleId)).vehicleType;
    const vehiclePricing = await findPricingRule(vehicleType);
    const durationMinutes = (exitTime - new Date(booking.actualEntryTime)) / (1000 * 60);
    const hours = Math.max(1, Math.ceil(durationMinutes / 60));
    const finalAmount = hours * vehiclePricing.pricePerHour;

    booking.actualExitTime = exitTime;
    booking.finalAmount = finalAmount;
    booking.status = 'COMPLETED';
    await booking.save();

    const slot = await ParkingSlot.findById(booking.slotId._id || booking.slotId);
    if (slot) {
      slot.status = 'AVAILABLE';
      await slot.save();
    }

    const payment = await Payment.findOne({ bookingId: booking._id });
    if (payment) {
      payment.amount = finalAmount;
      payment.paymentMethod = paymentMethod;
      payment.paymentStatus = 'PAID';
      payment.paidAt = new Date();
      payment.transactionReference = payment.transactionReference || `PAY-${booking.bookingId}`;
      await payment.save();
    } else {
      await Payment.create({
        bookingId: booking._id,
        userId: booking.userId,
        amount: finalAmount,
        paymentMethod,
        transactionReference: `PAY-${booking.bookingId}`,
        paymentStatus: 'PAID',
        paidAt: new Date(),
      });
    }

    await createNotification(
      booking.userId,
      'Parking Session Completed',
      `Your booking ${booking.bookingId} has ended. Final charge is ₹${finalAmount}.`,
      'PAYMENT'
    );

    res.status(200).json({
      success: true,
      message: 'Vehicle exit processed successfully.',
      data: {
        booking,
        finalAmount,
      },
    });
  } catch (error) {
    next(error);
  }
};
