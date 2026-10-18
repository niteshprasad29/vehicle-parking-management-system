import mongoose from 'mongoose';
import Vehicle from '../models/Vehicle.js';

/**
 * @desc    Register a new vehicle for authenticated user
 * @route   POST /api/vehicles
 * @access  Private (USER, ADMIN)
 */
export const createVehicle = async (req, res, next) => {
  try {
    const { vehicleNumber, vehicleType, vehicleModel, vehicleColor } = req.body;
    const formattedNumber = vehicleNumber.trim().toUpperCase();

    // Check if user has already added this vehicle number
    const existingVehicle = await Vehicle.findOne({
      userId: req.user._id,
      vehicleNumber: formattedNumber,
    });

    if (existingVehicle) {
      return res.status(409).json({
        success: false,
        message: 'Vehicle registration conflict: Plate already registered.',
        errors: [`Vehicle number '${formattedNumber}' is already registered under your account.`],
      });
    }

    const vehicle = await Vehicle.create({
      userId: req.user._id,
      vehicleNumber: formattedNumber,
      vehicleType: vehicleType.trim().toUpperCase(),
      vehicleModel: vehicleModel ? vehicleModel.trim() : '',
      vehicleColor: vehicleColor ? vehicleColor.trim() : '',
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle registered successfully.',
      data: {
        vehicle,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get vehicles (User gets own vehicles; Admin gets all with pagination)
 * @route   GET /api/vehicles
 * @access  Private (USER, ADMIN)
 */
export const getVehicles = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    // Filter: User gets only own vehicles; Admin gets all or can filter
    const query = req.user.role === 'ADMIN' ? {} : { userId: req.user._id };

    const total = await Vehicle.countDocuments(query);
    const vehicles = await Vehicle.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('userId', 'name email phone');

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      message: 'Vehicles retrieved successfully.',
      data: {
        vehicles,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasPrev: page > 1,
        hasNext: page < totalPages,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get vehicle by ID
 * @route   GET /api/vehicles/:id
 * @access  Private (USER, ADMIN)
 */
export const getVehicleById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const vehicle = await Vehicle.findById(id).populate('userId', 'name email phone');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found.',
        errors: [`Vehicle with id '${id}' does not exist.`],
      });
    }

    // Ownership check: User can only access their own vehicle
    const isOwner = vehicle.userId._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to access another user\'s vehicle.',
        errors: ['Access denied: Ownership verification failed.'],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Vehicle details retrieved successfully.',
      data: {
        vehicle,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update own vehicle
 * @route   PUT /api/vehicles/:id
 * @access  Private (USER, ADMIN)
 */
export const updateVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const vehicle = await Vehicle.findById(id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found.',
        errors: [`Vehicle with id '${id}' does not exist.`],
      });
    }

    // Ownership check
    const isOwner = vehicle.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot modify another user\'s vehicle.',
        errors: ['Access denied: Ownership verification failed.'],
      });
    }

    const { vehicleNumber, vehicleType, vehicleModel, vehicleColor } = req.body;

    if (vehicleNumber) {
      const formatted = vehicleNumber.trim().toUpperCase();
      // Check if duplicate for this user
      const duplicate = await Vehicle.findOne({
        _id: { $ne: id },
        userId: vehicle.userId,
        vehicleNumber: formatted,
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Vehicle registration conflict: Plate already registered.',
          errors: [`Vehicle number '${formatted}' is already registered under this account.`],
        });
      }
      vehicle.vehicleNumber = formatted;
    }

    if (vehicleType) vehicle.vehicleType = vehicleType.trim().toUpperCase();
    if (vehicleModel !== undefined) vehicle.vehicleModel = vehicleModel.trim();
    if (vehicleColor !== undefined) vehicle.vehicleColor = vehicleColor.trim();

    await vehicle.save();

    res.status(200).json({
      success: true,
      message: 'Vehicle updated successfully.',
      data: {
        vehicle,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete vehicle
 * @route   DELETE /api/vehicles/:id
 * @access  Private (USER, ADMIN)
 */
export const deleteVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid vehicle identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const vehicle = await Vehicle.findById(id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found.',
        errors: [`Vehicle with id '${id}' does not exist.`],
      });
    }

    // Ownership check
    const isOwner = vehicle.userId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You cannot delete another user\'s vehicle.',
        errors: ['Access denied: Ownership verification failed.'],
      });
    }

    await vehicle.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Vehicle deleted successfully.',
      data: {
        deletedId: id,
      },
    });
  } catch (error) {
    next(error);
  }
};
