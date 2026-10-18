import Booking from '../models/Booking.js';
import Payment from '../models/Payment.js';
import ShopOrder from '../models/ShopOrder.js';
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  isRazorpayConfigured,
  verifyRazorpaySignature,
} from '../utils/razorpay.js';

export const getPaymentConfig = async (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      onlinePaymentsEnabled: isRazorpayConfigured(),
      keyId: isRazorpayConfigured() ? getRazorpayKeyId() : '',
    },
  });
};

export const createPaymentOrder = async (req, res, next) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Online payments are not configured. Choose pay in person or configure Razorpay keys.',
      });
    }

    const { paymentId } = req.body;
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }
    if (payment.userId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You cannot pay for this record.' });
    }
    if (payment.paymentStatus === 'PAID') {
      return res.status(409).json({ success: false, message: 'This payment is already complete.' });
    }

    let receipt;
    if (payment.bookingId) {
      const booking = await Booking.findById(payment.bookingId);
      if (!booking) return res.status(404).json({ success: false, message: 'Booking not found.' });
      receipt = booking.bookingId;
    } else if (payment.shopOrderId) {
      const shopOrder = await ShopOrder.findById(payment.shopOrderId);
      if (!shopOrder) return res.status(404).json({ success: false, message: 'Shop order not found.' });
      receipt = shopOrder.orderNumber;
    } else {
      return res.status(400).json({ success: false, message: 'Payment has no associated purchase.' });
    }

    const gatewayOrder = await createRazorpayOrder({
      amount: payment.amount,
      receipt,
      notes: { paymentId: payment._id.toString() },
    });

    payment.paymentMethod = 'ONLINE';
    payment.razorpayOrderId = gatewayOrder.id;
    await payment.save();

    if (payment.shopOrderId) {
      await ShopOrder.findByIdAndUpdate(payment.shopOrderId, {
        paymentMethod: 'ONLINE',
        razorpayOrderId: gatewayOrder.id,
      });
    }

    res.status(201).json({
      success: true,
      data: {
        paymentId: payment._id,
        order: {
          id: gatewayOrder.id,
          amount: gatewayOrder.amount,
          currency: gatewayOrder.currency,
        },
        keyId: getRazorpayKeyId(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyPayment = async (req, res, next) => {
  try {
    if (!isRazorpayConfigured()) {
      return res.status(503).json({ success: false, message: 'Online payments are not configured.' });
    }

    const { paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }
    if (payment.userId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You cannot verify this payment.' });
    }
    if (payment.razorpayOrderId !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: 'Payment order does not match this purchase.' });
    }
    if (!verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    })) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.' });
    }

    payment.paymentStatus = 'PAID';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.transactionReference = razorpay_payment_id;
    payment.paidAt = new Date();
    await payment.save();

    let booking = null;
    let shopOrder = null;
    if (payment.bookingId) {
      booking = await Booking.findById(payment.bookingId)
        .populate('userId', 'name email phone')
        .populate('vehicleId', 'vehicleNumber vehicleType vehicleModel')
        .populate('locationId', 'name city state address')
        .populate('slotId', 'slotNumber status');
    }
    if (payment.shopOrderId) {
      shopOrder = await ShopOrder.findByIdAndUpdate(payment.shopOrderId, {
        paymentStatus: 'PAID',
        razorpayPaymentId: razorpay_payment_id,
        status: 'PLACED',
      }, { new: true });
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully.',
      data: { payment, booking, shopOrder },
    });
  } catch (error) {
    next(error);
  }
};

export const fallbackPaymentToCash = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }
    if (payment.userId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You cannot update this payment.' });
    }
    if ((!payment.bookingId && !payment.shopOrderId) || payment.paymentStatus !== 'PENDING' || !['ONLINE', 'UPI'].includes(payment.paymentMethod)) {
      return res.status(409).json({ success: false, message: 'Only pending online payments can switch to pay in person.' });
    }

    payment.paymentMethod = 'CASH';
    await payment.save();
    if (payment.shopOrderId) {
      await ShopOrder.findByIdAndUpdate(payment.shopOrderId, {
        paymentMethod: 'CASH',
        status: 'PLACED',
      });
    }
    res.status(200).json({ success: true, data: { payment } });
  } catch (error) {
    next(error);
  }
};

export const startUpiPayment = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }
    if (payment.userId.toString() !== req.user._id.toString() && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You cannot update this payment.' });
    }
    if (!payment.bookingId || payment.paymentStatus !== 'PENDING' || payment.paymentMethod !== 'CASH') {
      return res.status(409).json({ success: false, message: 'Only pending pay-in-person bookings can switch to UPI.' });
    }

    payment.paymentMethod = 'UPI';
    await payment.save();
    res.status(200).json({ success: true, data: { payment } });
  } catch (error) {
    next(error);
  }
};

export const getPayments = async (req, res, next) => {
  try {
    const query = req.user.role === 'ADMIN' ? {} : { userId: req.user._id };
    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .populate('bookingId', 'bookingId status')
      .populate('shopOrderId', 'orderNumber productName status');

    res.status(200).json({
      success: true,
      message: 'Payment records retrieved successfully.',
      data: { payments },
    });
  } catch (error) {
    next(error);
  }
};

export const getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('bookingId', 'bookingId status')
      .populate('shopOrderId', 'orderNumber productName status');
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found.',
        errors: [`Payment with id '${req.params.id}' does not exist.`],
      });
    }

    if (req.user.role !== 'ADMIN' && payment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have access to this payment record.',
        errors: ['Ownership verification failed.'],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Payment record retrieved successfully.',
      data: { payment },
    });
  } catch (error) {
    next(error);
  }
};
