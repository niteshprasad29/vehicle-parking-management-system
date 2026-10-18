import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: [true, 'Booking ID is required'],
      unique: true,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    customerName: {
      type: String,
      required: [true, 'Customer name is required'],
      trim: true,
    },
    customerPhone: {
      type: String,
      required: [true, 'Customer phone number is required'],
      trim: true,
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle',
      required: [true, 'Vehicle ID is required'],
      index: true,
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: [true, 'Parking location is required'],
      index: true,
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      required: [true, 'Parking slot is required'],
      index: true,
    },
    bookingDate: {
      type: Date,
      required: [true, 'Booking date is required'],
      default: Date.now,
    },
    expectedEntryTime: {
      type: Date,
      required: [true, 'Expected entry time is required'],
    },
    expectedExitTime: {
      type: Date,
      required: [true, 'Expected exit time is required'],
    },
    actualEntryTime: {
      type: Date,
      default: null,
    },
    actualExitTime: {
      type: Date,
      default: null,
    },
    estimatedAmount: {
      type: Number,
      default: 0,
      min: [0, 'Estimated amount cannot be negative'],
    },
    finalAmount: {
      type: Number,
      default: 0,
      min: [0, 'Final amount cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED'],
        message: '{VALUE} is not a valid booking status. Allowed: PENDING, CONFIRMED, ACTIVE, COMPLETED, CANCELLED',
      },
      default: 'CONFIRMED',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

bookingSchema.index({ slotId: 1, expectedEntryTime: 1, expectedExitTime: 1 });

const Booking = mongoose.model('Booking', bookingSchema);
export default Booking;
