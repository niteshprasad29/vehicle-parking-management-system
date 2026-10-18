import mongoose from 'mongoose';

const shopOrderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productSku: {
      type: String,
      required: true,
      trim: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [{
        productSku: { type: String, required: true, trim: true },
        productName: { type: String, required: true, trim: true },
        unitPrice: { type: Number, required: true, min: 0 },
        quantity: { type: Number, required: true, min: 1 },
      }],
      default: [],
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    vehicleNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    deliveryAddress: {
      type: String,
      required: true,
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['CASH', 'ONLINE'],
      default: 'CASH',
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    razorpayOrderId: {
      type: String,
      default: '',
    },
    razorpayPaymentId: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['PAYMENT_PENDING', 'PLACED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
      default: 'PLACED',
    },
  },
  { timestamps: true }
);

const ShopOrder = mongoose.model('ShopOrder', shopOrderSchema);
export default ShopOrder;