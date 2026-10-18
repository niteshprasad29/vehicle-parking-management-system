import jwt from 'jsonwebtoken';

/**
 * Generate signed JWT token containing userId and role
 * @param {string} userId - User's MongoDB ObjectId
 * @param {string} role - User's role ('USER', 'STAFF', 'ADMIN')
 * @returns {string} Signed JWT token
 */
export const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_for_dev_only';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign(
    {
      id: userId,
      role: role,
    },
    secret,
    {
      expiresIn: expiresIn,
    }
  );
};
