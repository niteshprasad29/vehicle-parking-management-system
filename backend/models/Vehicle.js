import mongoose from 'mongoose';

const vehicleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Vehicle owner (userId) is required'],
      index: true,
    },
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle registration number is required'],
      uppercase: true,
      trim: true,
      match: [
        /^[A-Z0-9 -]{4,20}$/,
        'Please provide a valid vehicle registration number (4 to 20 alphanumeric characters)',
      ],
      index: true,
    },
    vehicleType: {
      type: String,
      required: [true, 'Vehicle type is required'],
      enum: {
        values: ['BIKE', 'CAR', 'SUV', 'OTHER'],
        message: '{VALUE} is not a valid vehicle type. Allowed: BIKE, CAR, SUV, OTHER',
      },
      index: true,
    },
    vehicleModel: {
      type: String,
      trim: true,
      default: '',
    },
    vehicleColor: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate vehicle registration number under the same user account
vehicleSchema.index({ userId: 1, vehicleNumber: 1 }, { unique: true });

const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export default Vehicle;
