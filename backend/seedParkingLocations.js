import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import indiaLocations from './data/indiaLocations.js';
import ParkingLocation from './models/ParkingLocation.js';
import ParkingSlot from './models/ParkingSlot.js';
import PricingRule from './models/PricingRule.js';

dotenv.config();

const slotTypes = ['CAR', 'BIKE', 'SUV', 'OTHER', 'CAR', 'BIKE'];
const pricingDefaults = [
  { vehicleType: 'BIKE', pricePerHour: 20 },
  { vehicleType: 'CAR', pricePerHour: 40 },
  { vehicleType: 'SUV', pricePerHour: 60 },
  { vehicleType: 'OTHER', pricePerHour: 50 },
];

try {
  await connectDB();

  let locationsAdded = 0;
  let slotsAdded = 0;

  for (const [index, place] of indiaLocations.entries()) {
    let location = await ParkingLocation.findOne({ city: place.city, state: place.state });

    if (!location) {
      location = await ParkingLocation.create({
        name: `ParkEase ${place.city} Parking`,
        address: `Central parking hub, ${place.city}`,
        city: place.city,
        state: place.state,
        contactNumber: `+91 987654${String(3200 + index).slice(-4)}`,
        openingTime: '06:00',
        closingTime: '23:00',
        totalSlots: slotTypes.length,
        status: 'ACTIVE',
      });
      locationsAdded += 1;

      await ParkingSlot.insertMany(slotTypes.map((vehicleType, slotIndex) => ({
        locationId: location._id,
        slotNumber: `${String.fromCharCode(65 + (index % 20))}-${String(slotIndex + 1).padStart(2, '0')}`,
        vehicleType,
      })));
      slotsAdded += slotTypes.length;
    }
  }

  for (const pricingRule of pricingDefaults) {
    await PricingRule.updateOne(
      { vehicleType: pricingRule.vehicleType },
      { $setOnInsert: { ...pricingRule, isActive: true } },
      { upsert: true }
    );
  }

  console.log(`[Seeder] Added ${locationsAdded} parking locations and ${slotsAdded} slots.`);
  console.log('[Seeder] Existing locations, slots, pricing, and users were preserved.');
} catch (error) {
  console.error(`[Seeder] Failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}