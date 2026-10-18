import mongoose from 'mongoose';
import ParkingSlot from '../models/ParkingSlot.js';
import ParkingLocation from '../models/ParkingLocation.js';

/**
 * @desc    Create a new parking slot
 * @route   POST /api/parking-slots
 * @access  Private (ADMIN only)
 */
export const createSlot = async (req, res, next) => {
  try {
    const { locationId, slotNumber, vehicleType, floor, status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(locationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location identifier format.',
        errors: [`'${locationId}' is not a valid MongoDB ObjectId.`],
      });
    }

    // Verify parking location exists
    const location = await ParkingLocation.findById(locationId);
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Referenced parking location not found.',
        errors: [`Parking location with id '${locationId}' does not exist.`],
      });
    }

    const formattedSlot = slotNumber.trim().toUpperCase();

    // Check duplicate slot within same location
    const existingSlot = await ParkingSlot.findOne({
      locationId,
      slotNumber: formattedSlot,
    });

    if (existingSlot) {
      return res.status(409).json({
        success: false,
        message: 'Slot creation conflict: Slot already exists in this location.',
        errors: [`Slot '${formattedSlot}' already exists in location '${location.name}'.`],
      });
    }

    const slot = await ParkingSlot.create({
      locationId,
      slotNumber: formattedSlot,
      vehicleType: vehicleType.trim().toUpperCase(),
      floor: floor ? floor.trim() : 'Ground',
      status: status || 'AVAILABLE',
    });

    // Increment location totalSlots
    location.totalSlots = (location.totalSlots || 0) + 1;
    await location.save();

    res.status(201).json({
      success: true,
      message: 'Parking slot created successfully.',
      data: {
        slot,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all parking slots (Public with filters & pagination)
 * @route   GET /api/parking-slots
 * @access  Public
 */
export const getSlots = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    if (limit > 100) limit = 100;

    const filter = {};

    if (req.query.locationId) {
      if (!mongoose.Types.ObjectId.isValid(req.query.locationId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid location identifier format in filter query.',
          errors: [`'${req.query.locationId}' is not a valid MongoDB ObjectId.`],
        });
      }
      filter.locationId = req.query.locationId;
    }

    if (req.query.vehicleType) {
      filter.vehicleType = req.query.vehicleType.trim().toUpperCase();
    }

    if (req.query.status) {
      filter.status = req.query.status.trim().toUpperCase();
    }

    const skip = (page - 1) * limit;
    const total = await ParkingSlot.countDocuments(filter);
    const slots = await ParkingSlot.find(filter)
      .sort({ slotNumber: 1 })
      .skip(skip)
      .limit(limit)
      .populate('locationId', 'name address city state openingTime closingTime');

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      message: 'Parking slots retrieved successfully.',
      data: {
        slots,
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
 * @desc    Get parking slot by ID
 * @route   GET /api/parking-slots/:id
 * @access  Public
 */
export const getSlotById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid slot identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const slot = await ParkingSlot.findById(id).populate(
      'locationId',
      'name address city contactNumber status'
    );

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Parking slot not found.',
        errors: [`Slot with id '${id}' does not exist.`],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Parking slot details retrieved successfully.',
      data: {
        slot,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update parking slot
 * @route   PUT /api/parking-slots/:id
 * @access  Private (ADMIN only)
 */
export const updateSlot = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid slot identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const slot = await ParkingSlot.findById(id);

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Parking slot not found.',
        errors: [`Slot with id '${id}' does not exist.`],
      });
    }

    const { slotNumber, vehicleType, floor, status } = req.body;

    if (slotNumber) {
      const formatted = slotNumber.trim().toUpperCase();
      const duplicate = await ParkingSlot.findOne({
        _id: { $ne: id },
        locationId: slot.locationId,
        slotNumber: formatted,
      });

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: 'Slot update conflict: Slot number already in use for this location.',
          errors: [`Slot '${formatted}' already exists in this parking location.`],
        });
      }
      slot.slotNumber = formatted;
    }

    if (vehicleType) slot.vehicleType = vehicleType.trim().toUpperCase();
    if (floor !== undefined) slot.floor = floor.trim();
    if (status) slot.status = status;

    await slot.save();

    res.status(200).json({
      success: true,
      message: 'Parking slot updated successfully.',
      data: {
        slot,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete parking slot
 * @route   DELETE /api/parking-slots/:id
 * @access  Private (ADMIN only)
 */
export const deleteSlot = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid slot identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const slot = await ParkingSlot.findById(id);

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'Parking slot not found.',
        errors: [`Slot with id '${id}' does not exist.`],
      });
    }

    const locationId = slot.locationId;
    await slot.deleteOne();

    // Decrement location totalSlots
    await ParkingLocation.findByIdAndUpdate(locationId, {
      $inc: { totalSlots: -1 },
    });

    res.status(200).json({
      success: true,
      message: 'Parking slot deleted successfully.',
      data: {
        deletedId: id,
      },
    });
  } catch (error) {
    next(error);
  }
};
