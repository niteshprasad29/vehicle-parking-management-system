/**
 * Input validators for Vehicle management endpoints
 */

const ALLOWED_VEHICLE_TYPES = ['BIKE', 'CAR', 'SUV', 'OTHER'];
const VEHICLE_NUMBER_REGEX = /^[A-Z0-9 -]{4,20}$/;

export const validateVehicleInput = (data) => {
  const errors = [];
  const { vehicleNumber, vehicleType, vehicleModel, vehicleColor } = data || {};

  // Vehicle Number Validation
  if (!vehicleNumber || typeof vehicleNumber !== 'string' || vehicleNumber.trim().length === 0) {
    errors.push('Vehicle registration number is required.');
  } else if (!VEHICLE_NUMBER_REGEX.test(vehicleNumber.trim().toUpperCase())) {
    errors.push('Invalid vehicle registration number format (4 to 20 alphanumeric characters).');
  }

  // Vehicle Type Validation
  if (!vehicleType || typeof vehicleType !== 'string' || vehicleType.trim().length === 0) {
    errors.push('Vehicle type is required.');
  } else if (!ALLOWED_VEHICLE_TYPES.includes(vehicleType.trim().toUpperCase())) {
    errors.push(`Invalid vehicle type '${vehicleType}'. Allowed: ${ALLOWED_VEHICLE_TYPES.join(', ')}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateVehicleUpdateInput = (data) => {
  const errors = [];
  const { vehicleNumber, vehicleType } = data || {};

  if (vehicleNumber !== undefined) {
    if (typeof vehicleNumber !== 'string' || !VEHICLE_NUMBER_REGEX.test(vehicleNumber.trim().toUpperCase())) {
      errors.push('Invalid vehicle registration number format.');
    }
  }

  if (vehicleType !== undefined) {
    if (typeof vehicleType !== 'string' || !ALLOWED_VEHICLE_TYPES.includes(vehicleType.trim().toUpperCase())) {
      errors.push(`Invalid vehicle type. Allowed: ${ALLOWED_VEHICLE_TYPES.join(', ')}.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
