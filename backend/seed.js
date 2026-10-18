import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import ParkingLocation from './models/ParkingLocation.js';
import ParkingSlot from './models/ParkingSlot.js';
import PricingRule from './models/PricingRule.js';
import indiaLocations from './data/indiaLocations.js';

dotenv.config();

const seedPhase1Users = async () => {
  try {
    console.log('[Seeder] Connecting to MongoDB...');
    await connectDB();

    console.log('[Seeder] Cleaning existing demo user accounts...');
    await User.deleteMany({
      email: {
        $in: [
          'admin@parkease.com',
          'staff@parkease.com',
          'user@parkease.com',
          'inactive@parkease.com',
        ],
      },
    });

    console.log('[Seeder] Inserting demo accounts with hashed passwords...');

    const usersToCreate = [
      {
        name: 'System Administrator',
        email: 'admin@parkease.com',
        phone: '+91 9876543210',
        password: 'Admin@123',
        role: 'ADMIN',
        isActive: true,
      },
      {
        name: 'Gate Attendant Staff',
        email: 'staff@parkease.com',
        phone: '+91 9876543211',
        password: 'Staff@123',
        role: 'STAFF',
        isActive: true,
      },
      {
        name: 'John Doe Customer',
        email: 'user@parkease.com',
        phone: '+91 9876543212',
        password: 'User@123',
        role: 'USER',
        isActive: true,
      },
      {
        name: 'Deactivated Customer',
        email: 'inactive@parkease.com',
        phone: '+91 9876543213',
        password: 'User@123',
        role: 'USER',
        isActive: false, // For testing inactive login rejection
      },
    ];

    for (const userData of usersToCreate) {
      // User.create triggers the pre('save') hook to hash password with bcrypt
      await User.create(userData);
    }

    console.log('[Seeder] Preparing demo parking network and pricing rules...');
    await ParkingSlot.deleteMany({});
    await ParkingLocation.deleteMany({
      $or: [
        { name: /^ParkEase .* Parking$/ },
        { name: { $in: ['Campus North Parking', 'Market Square Parking'] } },
      ],
    });
    await PricingRule.deleteMany({});

    const locations = await ParkingLocation.create(
      indiaLocations.map((location, index) => ({
        name: `ParkEase ${location.city} Parking`,
        address: `Central parking hub, ${location.city}`,
        city: location.city,
        state: location.state,
        contactNumber: `+91 987654${String(3200 + index).slice(-4)}`,
        openingTime: '06:00',
        closingTime: '23:00',
        totalSlots: 6,
        status: 'ACTIVE',
      }))
    );

    const slotTemplates = [
      ...locations.flatMap((location, locationIndex) => [
        { locationId: location._id, slotNumber: `${String.fromCharCode(65 + (locationIndex % 20))}-01`, vehicleType: 'CAR' },
        { locationId: location._id, slotNumber: `${String.fromCharCode(65 + (locationIndex % 20))}-02`, vehicleType: 'BIKE' },
        { locationId: location._id, slotNumber: `${String.fromCharCode(65 + (locationIndex % 20))}-03`, vehicleType: 'SUV' },
        { locationId: location._id, slotNumber: `${String.fromCharCode(65 + (locationIndex % 20))}-04`, vehicleType: 'OTHER' },
        { locationId: location._id, slotNumber: `${String.fromCharCode(65 + (locationIndex % 20))}-05`, vehicleType: 'CAR' },
        { locationId: location._id, slotNumber: `${String.fromCharCode(65 + (locationIndex % 20))}-06`, vehicleType: 'BIKE' },
      ]),
    ];
    await ParkingSlot.insertMany(slotTemplates);

    await PricingRule.insertMany([
      { vehicleType: 'BIKE', pricePerHour: 20, isActive: true },
      { vehicleType: 'CAR', pricePerHour: 40, isActive: true },
      { vehicleType: 'SUV', pricePerHour: 60, isActive: true },
      { vehicleType: 'OTHER', pricePerHour: 50, isActive: true },
    ]);

    console.log('================================================================');
    console.log(' [SEED SUCCESSFUL] Demo accounts ready for testing:');
    console.log('----------------------------------------------------------------');
    console.log(' 1. ADMIN USER:');
    console.log('    Email:    admin@parkease.com');
    console.log('    Password: Admin@123');
    console.log('    Role:     ADMIN');
    console.log('----------------------------------------------------------------');
    console.log(' 2. STAFF USER:');
    console.log('    Email:    staff@parkease.com');
    console.log('    Password: Staff@123');
    console.log('    Role:     STAFF');
    console.log('----------------------------------------------------------------');
    console.log(' 3. REGULAR CUSTOMER:');
    console.log('    Email:    user@parkease.com');
    console.log('    Password: User@123');
    console.log('    Role:     USER');
    console.log('----------------------------------------------------------------');
    console.log(' 4. INACTIVE USER (For 403 test):');
    console.log('    Email:    inactive@parkease.com');
    console.log('    Password: User@123');
    console.log('    Role:     USER (isActive: false)');
    console.log('================================================================');

    await mongoose.disconnect();
    console.log('[Seeder] Database disconnected. Process complete.');
    process.exit(0);
  } catch (error) {
    console.error(`[Seeder Error]: ${error.message}`);
    process.exit(1);
  }
};

seedPhase1Users();
