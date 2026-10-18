import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import Booking from './models/Booking.js';
import User from './models/User.js';

dotenv.config({ path: './backend/.env' });

const migrateBookingContacts = async () => {
  await connectDB();

  const bookings = await Booking.find({
    $or: [
      { customerName: { $exists: false } },
      { customerName: '' },
      { customerPhone: { $exists: false } },
      { customerPhone: '' },
    ],
  }).select('_id userId');

  let updated = 0;
  for (const booking of bookings) {
    const user = await User.findById(booking.userId).select('name phone');
    if (!user) continue;

    await Booking.updateOne(
      { _id: booking._id },
      { $set: { customerName: user.name, customerPhone: user.phone } }
    );
    updated += 1;
  }

  console.log(`[Migration] Updated ${updated} booking contact record(s).`);
  await mongoose.disconnect();
};

migrateBookingContacts().catch((error) => {
  console.error(`[Migration Error] ${error.message}`);
  process.exitCode = 1;
});
