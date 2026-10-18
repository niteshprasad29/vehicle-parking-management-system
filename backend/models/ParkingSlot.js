import mongoose from 'mongoose';

const parkingSlotSchema = new mongoose.Schema(
  {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: [true, 'Parking location (locationId) is required'],
      index: true,
    },
    slotNumber: {
      type: String,
      required: [true, 'Slot number is required (e.g. A-01, B-12)'],
      uppercase: true,
      trim: true,
    },
    vehicleType: {
      type: String,
      required: [true, 'Permitted vehicle type is required'],
      enum: {
        values: ['BIKE', 'CAR', 'SUV', 'OTHER'],
        message: '{VALUE} is not a valid vehicle type. Allowed: BIKE, CAR, SUV, OTHER',
      },
      index: true,
    },
    floor: {
      type: String,
      trim: true,
      default: 'Ground',
    },
    status: {
      type: String,
      enum: {
        values: ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'DISABLED'],
        message: '{VALUE} is not a valid slot status. Allowed: AVAILABLE, RESERVED, OCCUPIED, MAINTENANCE, DISABLED',
      },
      default: 'AVAILABLE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate slot number within the exact same parking location
parkingSlotSchema.index({ locationId: 1, slotNumber: 1 }, { unique: true });

const ParkingSlot = mongoose.model('ParkingSlot', parkingSlotSchema);
export default ParkingSlot;
