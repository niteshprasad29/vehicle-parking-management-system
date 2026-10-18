import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a full name'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters long'],
      maxlength: [60, 'Name cannot exceed 60 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email address'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Please provide a contact phone number'],
      trim: true,
      match: [
        /^[0-9+\-\s]{7,15}$/,
        'Please provide a valid phone number (7 to 15 digits)',
      ],
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters long'],
      select: false, // Exclude password from query results by default
    },
    role: {
      type: String,
      enum: {
        values: ['USER', 'STAFF', 'ADMIN'],
        message: '{VALUE} is not a valid user role',
      },
      default: 'USER',
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    assignedLocationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Pre-save middleware: Hash password using bcrypt before saving to MongoDB
 */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/**
 * Helper method to compare candidate password with stored hash
 */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);
export default User;
