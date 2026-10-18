import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Authentication Middleware
 * Validates Bearer token in Authorization header and populates req.user
 */
export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access denied: No token provided.',
          errors: ['Authentication token is missing from Bearer header.'],
        });
      }

      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET
      );

      // Fetch user from DB excluding password
      const user = await User.findById(decoded.id).select('-password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication failed: User no longer exists.',
          errors: ['The account associated with this token was not found.'],
        });
      }

      // Check if user account is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account disabled: Please contact the system administrator.',
          errors: ['Your account has been deactivated.'],
        });
      }

      // Attach user object to request
      req.user = user;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session expired: Please log in again.',
          errors: ['The provided authentication token has expired.'],
        });
      }

      return res.status(401).json({
        success: false,
        message: 'Authentication failed: Invalid token.',
        errors: ['The provided Bearer token is malformed or invalid.'],
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Access denied: Authorization header missing.',
      errors: ['Please provide a Bearer token in the Authorization header.'],
    });
  }
};
