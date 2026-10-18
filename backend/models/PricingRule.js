import mongoose from 'mongoose';

const pricingRuleSchema = new mongoose.Schema(
  {
    vehicleType: {
      type: String,
      required: [true, 'Vehicle type is required'],
      enum: {
        values: ['BIKE', 'CAR', 'SUV', 'OTHER'],
        message: '{VALUE} is not a valid vehicle type. Allowed: BIKE, CAR, SUV, OTHER',
      },
      unique: true,
      index: true,
    },
    pricePerHour: {
      type: Number,
      required: [true, 'Price per hour is required'],
      min: [0, 'Price per hour cannot be negative'],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

const PricingRule = mongoose.model('PricingRule', pricingRuleSchema);
export default PricingRule;
