/**
 * Authentication input validators for ParkEase API
 */

export const validateRegisterInput = (data) => {
  const errors = [];
  const { name, email, phone, password, confirmPassword } = data || {};

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Full name is required.');
  } else if (name.trim().length < 2) {
    errors.push('Full name must be at least 2 characters long.');
  } else if (name.trim().length > 60) {
    errors.push('Full name cannot exceed 60 characters.');
  }

  // Email validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push('Email address is required.');
  } else if (!emailRegex.test(email.trim())) {
    errors.push('Please provide a valid email address.');
  }

  // Phone validation
  const phoneRegex = /^[0-9+\-\s]{7,15}$/;
  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    errors.push('Phone number is required.');
  } else if (!phoneRegex.test(phone.trim())) {
    errors.push('Please provide a valid phone number (7 to 15 digits).');
  }

  // Password validation
  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  } else {
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long.');
    }
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one numeric digit.');
    }
  }

  // Confirm password validation
  if (!confirmPassword) {
    errors.push('Please confirm your password.');
  } else if (password !== confirmPassword) {
    errors.push('Passwords do not match.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateLoginInput = (data) => {
  const errors = [];
  const { email, password } = data || {};

  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push('Email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    errors.push('Password is required.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const validateProfileUpdateInput = (data) => {
  const errors = [];
  const { name, phone, currentPassword, newPassword, confirmNewPassword } = data || {};

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long.');
    }
  }

  if (phone !== undefined) {
    const phoneRegex = /^[0-9+\-\s]{7,15}$/;
    if (typeof phone !== 'string' || !phoneRegex.test(phone.trim())) {
      errors.push('Please provide a valid phone number (7 to 15 digits).');
    }
  }

  // If user wants to change password
  if (newPassword) {
    if (!currentPassword) {
      errors.push('Current password is required to set a new password.');
    }
    if (newPassword.length < 8) {
      errors.push('New password must be at least 8 characters long.');
    }
    if (!/\d/.test(newPassword)) {
      errors.push('New password must contain at least one numeric digit.');
    }
    if (confirmNewPassword && newPassword !== confirmNewPassword) {
      errors.push('New passwords do not match.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
