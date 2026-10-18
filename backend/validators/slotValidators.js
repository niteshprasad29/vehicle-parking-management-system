import mongoose from 'mongoose';

/**
 * Input validators for Parking Slot endpoints
 */

const ALLOWED_VEHICLE_TYPES = ['BIKE', 'CAR', 'SUV', 'OTHER'];
const ALLOWED_STATUSES = ['AVAILABLE', 'RESERVED', 'OCCUPIED', 'MAINTENANCE', 'DISABLED'];

export const validateSlotInput = (data) => {
  const errors = [];
  const { locationId, slotNumber, vehicleType, floor, status } = data || {};

  // Location ID
  if (!locationId || typeof locationId !== 'string' || !mongoose.Types.ObjectId.isValid(locationId)) {
    errors.push('A valid parking location ID (ObjectId) is required.');
  }

  // Slot Number
  if (!slotNumber || typeof slotNumber !== 'string' || slotNumber.trim().length === 0) {
    errors.push('Slot number is required (e.g. A-01, B-12).');
  }

  // Vehicle Type
  if (!vehicleType || typeof vehicleType !== 'string' || vehicleType.trim().length === 0) {
    errors.push('Permitted vehicle type is required.');
  } else if (!ALLOWED_VEHICLE_TYPES.includes(vehicleType.trim().toUpperCase())) {
    errors.push(`Invalid vehicle type '${vehicleType}'. Allowed: ${ALLOWED_VEHICLE_TYPES.join(', ')}.`);
  }

  // Status
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push(`Invalid slot status '${status}'. Allowed: ${ALLOWED_STATUSES.join(', ')}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateSlotUpdateInput = (data) => {
  const errors = [];
  const { slotNumber, vehicleType, status } = data || {};

  if (slotNumber !== undefined && (typeof slotNumber !== 'string' || slotNumber.trim().length === 0)) {
    errors.push('Slot number cannot be empty.');
  }

  if (vehicleType !== undefined && (typeof vehicleType !== 'string' || !ALLOWED_VEHICLE_TYPES.includes(vehicleType.trim().toUpperCase()))) {
    errors.push(`Invalid vehicle type. Allowed: ${ALLOWED_VEHICLE_TYPES.join(', ')}.`);
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push(`Invalid slot status '${status}'. Allowed: ${ALLOWED_STATUSES.join(', ')}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
