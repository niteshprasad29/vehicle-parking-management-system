/**
 * Input validators for Parking Location endpoints
 */

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
const PHONE_REGEX = /^[0-9+\-\s]{7,15}$/;
const ALLOWED_STATUSES = ['ACTIVE', 'INACTIVE', 'MAINTENANCE'];

export const validateLocationInput = (data) => {
  const errors = [];
  const { name, address, city, state, contactNumber, openingTime, closingTime, status } = data || {};

  // Name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Parking location name is required.');
  } else if (name.trim().length < 3) {
    errors.push('Location name must be at least 3 characters long.');
  }

  // Address
  if (!address || typeof address !== 'string' || address.trim().length === 0) {
    errors.push('Physical address is required.');
  } else if (address.trim().length < 5) {
    errors.push('Address must be at least 5 characters long.');
  }

  // City
  if (!city || typeof city !== 'string' || city.trim().length === 0) {
    errors.push('City is required.');
  }

  if (!state || typeof state !== 'string' || state.trim().length === 0) {
    errors.push('State or union territory is required.');
  }

  // Contact Number
  if (!contactNumber || typeof contactNumber !== 'string' || contactNumber.trim().length === 0) {
    errors.push('Contact phone number is required.');
  } else if (!PHONE_REGEX.test(contactNumber.trim())) {
    errors.push('Invalid contact phone number format (7 to 15 digits).');
  }

  // Opening & Closing time
  if (openingTime !== undefined && !TIME_REGEX.test(openingTime)) {
    errors.push('Opening time must be in valid HH:mm format (e.g. 06:00).');
  }

  if (closingTime !== undefined && !TIME_REGEX.test(closingTime)) {
    errors.push('Closing time must be in valid HH:mm format (e.g. 23:00).');
  }

  // Status
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push(`Invalid location status '${status}'. Allowed: ${ALLOWED_STATUSES.join(', ')}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateLocationUpdateInput = (data) => {
  const errors = [];
  const { name, address, city, state, contactNumber, openingTime, closingTime, status } = data || {};

  if (name !== undefined && (typeof name !== 'string' || name.trim().length < 3)) {
    errors.push('Location name must be at least 3 characters long.');
  }

  if (address !== undefined && (typeof address !== 'string' || address.trim().length < 5)) {
    errors.push('Address must be at least 5 characters long.');
  }

  if (city !== undefined && (typeof city !== 'string' || city.trim().length === 0)) {
    errors.push('City cannot be empty.');
  }

  if (state !== undefined && (typeof state !== 'string' || state.trim().length === 0)) {
    errors.push('State cannot be empty.');
  }

  if (contactNumber !== undefined && (typeof contactNumber !== 'string' || !PHONE_REGEX.test(contactNumber.trim()))) {
    errors.push('Invalid contact phone number format.');
  }

  if (openingTime !== undefined && !TIME_REGEX.test(openingTime)) {
    errors.push('Opening time must be in valid HH:mm format.');
  }

  if (closingTime !== undefined && !TIME_REGEX.test(closingTime)) {
    errors.push('Closing time must be in valid HH:mm format.');
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    errors.push(`Invalid location status '${status}'. Allowed: ${ALLOWED_STATUSES.join(', ')}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
