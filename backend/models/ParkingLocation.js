import mongoose from 'mongoose';

const parkingLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Parking location name is required'],
      trim: true,
      minlength: [3, 'Location name must be at least 3 characters long'],
      maxlength: [100, 'Location name cannot exceed 100 characters'],
    },
    address: {
      type: String,
      required: [true, 'Physical address is required'],
      trim: true,
      minlength: [5, 'Address must be at least 5 characters long'],
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true,
      index: true,
    },
    state: {
      type: String,
      required: [true, 'State or union territory is required'],
      trim: true,
      index: true,
    },
    contactNumber: {
      type: String,
      required: [true, 'Contact phone number is required'],
      trim: true,
      match: [
        /^[0-9+\-\s]{7,15}$/,
        'Please provide a valid contact number (7 to 15 digits)',
      ],
    },
    openingTime: {
      type: String,
      required: [true, 'Opening time is required'],
      default: '06:00',
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        'Opening time must be in HH:mm format (24-hour clock, e.g. 06:00)',
      ],
    },
    closingTime: {
      type: String,
      required: [true, 'Closing time is required'],
      default: '23:00',
      match: [
        /^([01]\d|2[0-3]):([0-5]\d)$/,
        'Closing time must be in HH:mm format (24-hour clock, e.g. 23:00)',
      ],
    },
    totalSlots: {
      type: Number,
      default: 0,
      min: [0, 'Total slots cannot be negative'],
    },
    status: {
      type: String,
      enum: {
        values: ['ACTIVE', 'INACTIVE', 'MAINTENANCE'],
        message: '{VALUE} is not a valid location status. Allowed: ACTIVE, INACTIVE, MAINTENANCE',
      },
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const ParkingLocation = mongoose.model('ParkingLocation', parkingLocationSchema);
export default ParkingLocation;
