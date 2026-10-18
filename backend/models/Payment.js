import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    shopOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShopOrder',
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [0, 'Payment amount cannot be negative'],
    },
    paymentMethod: {
      type: String,
      enum: {
        values: ['CASH', 'UPI', 'CARD', 'ONLINE'],
        message: '{VALUE} is not a valid payment method. Allowed: CASH, UPI, CARD, ONLINE',
      },
      default: 'CASH',
    },
    transactionReference: {
      type: String,
      trim: true,
      default: '',
    },
    razorpayOrderId: {
      type: String,
      default: '',
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      default: '',
    },
    paymentStatus: {
      type: String,
      enum: {
        values: ['PENDING', 'PAID', 'FAILED', 'REFUNDED'],
        message: '{VALUE} is not a valid payment status. Allowed: PENDING, PAID, FAILED, REFUNDED',
      },
      default: 'PENDING',
      index: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Payment = mongoose.model('Payment', paymentSchema);
export default Payment;
