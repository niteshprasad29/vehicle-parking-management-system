import User from '../models/User.js';
import { generateToken } from '../utils/generateToken.js';

/**
 * @desc    Register a new customer account
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if email is already taken
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Registration conflict: Email already in use.',
        errors: ['An account with this email address already exists. Please log in instead.'],
      });
    }

    // Create user with default role 'USER'
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password, // Will be hashed by pre-save hook in User model
      role: 'USER',
      isActive: true,
    });

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    // Return safe user representation (password excluded)
    res.status(201).json({
      success: true,
      message: 'Registration successful. Welcome to ParkEase!',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Authenticate user & return JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user by email and explicitly include password for comparison
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
        errors: ['Invalid email or password combination.'],
      });
    }

    // Compare passwords
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.',
        errors: ['Invalid email or password combination.'],
      });
    }

    // Check account status
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Account disabled: Access denied.',
        errors: ['Your account has been deactivated. Please contact support.'],
      });
    }

    // Generate JWT token
    const token = generateToken(user._id, user.role);

    res.status(200).json({
      success: true,
      message: 'Login successful. Welcome back!',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          assignedLocationId: user.assignedLocationId,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently authenticated user's profile
 * @route   GET /api/auth/me
 * @access  Private (All authenticated roles)
 */
export const getMe = async (req, res, next) => {
  try {
    // req.user is attached by protect middleware
    res.status(200).json({
      success: true,
      message: 'Current profile retrieved successfully.',
      data: {
        user: req.user,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update authenticated user's profile details & optional password change
 * @route   PUT /api/auth/profile
 * @access  Private (All authenticated roles)
 */
export const updateProfile = async (req, res, next) => {
  try {
    const { name, phone, currentPassword, newPassword } = req.body;

    // Find user including password in case password change is requested
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User account not found.',
        errors: ['Account could not be found.'],
      });
    }

    // Update name if provided
    if (name) {
      user.name = name.trim();
    }

    // Update phone if provided
    if (phone) {
      user.phone = phone.trim();
    }

    // Process password change if newPassword is provided
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Password change failed: Current password required.',
          errors: ['You must provide your current password to set a new password.'],
        });
      }

      const isCurrentMatch = await user.matchPassword(currentPassword);
      if (!isCurrentMatch) {
        return res.status(400).json({
          success: false,
          message: 'Password change failed: Incorrect current password.',
          errors: ['The current password entered is incorrect.'],
        });
      }

      // Assign new password (pre-save hook will hash it)
      user.password = newPassword;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          isActive: user.isActive,
          assignedLocationId: user.assignedLocationId,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
