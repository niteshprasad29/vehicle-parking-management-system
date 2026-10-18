import mongoose from 'mongoose';
import ParkingLocation from '../models/ParkingLocation.js';

/**
 * @desc    Create a new parking location
 * @route   POST /api/parking-locations
 * @access  Private (ADMIN only)
 */
export const createLocation = async (req, res, next) => {
  try {
    const { name, address, city, state, contactNumber, openingTime, closingTime, status } = req.body;

    const location = await ParkingLocation.create({
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      contactNumber: contactNumber.trim(),
      openingTime: openingTime || '06:00',
      closingTime: closingTime || '23:00',
      status: status || 'ACTIVE',
      totalSlots: 0,
    });

    res.status(201).json({
      success: true,
      message: 'Parking location created successfully.',
      data: {
        location,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all parking locations (Public, with pagination and filters)
 * @route   GET /api/parking-locations
 * @access  Public
 */
export const getLocations = async (req, res, next) => {
  try {
    let page = parseInt(req.query.page, 10) || 1;
    let limit = parseInt(req.query.limit, 10) || 10;
    if (page < 1) page = 1;
    if (limit < 1) limit = 10;
    if (limit > 100) limit = 100;

    const filter = {};
    if (req.query.city) {
      filter.city = new RegExp(req.query.city.trim(), 'i');
    }
    if (req.query.state) {
      filter.state = new RegExp(req.query.state.trim(), 'i');
    }
    if (req.query.status) {
      filter.status = req.query.status.toUpperCase();
    }

    const skip = (page - 1) * limit;
    const total = await ParkingLocation.countDocuments(filter);
    const locations = await ParkingLocation.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit) || 1;

    res.status(200).json({
      success: true,
      message: 'Parking locations retrieved successfully.',
      data: {
        locations,
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
 * @desc    Get single parking location by ID
 * @route   GET /api/parking-locations/:id
 * @access  Public
 */
export const getLocationById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const location = await ParkingLocation.findById(id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Parking location not found.',
        errors: [`Location with id '${id}' does not exist.`],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Parking location details retrieved successfully.',
      data: {
        location,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update parking location
 * @route   PUT /api/parking-locations/:id
 * @access  Private (ADMIN only)
 */
export const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const location = await ParkingLocation.findById(id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Parking location not found.',
        errors: [`Location with id '${id}' does not exist.`],
      });
    }

    const { name, address, city, state, contactNumber, openingTime, closingTime, status } = req.body;

    if (name) location.name = name.trim();
    if (address) location.address = address.trim();
    if (city) location.city = city.trim();
    if (state) location.state = state.trim();
    if (contactNumber) location.contactNumber = contactNumber.trim();
    if (openingTime) location.openingTime = openingTime;
    if (closingTime) location.closingTime = closingTime;
    if (status) location.status = status;

    await location.save();

    res.status(200).json({
      success: true,
      message: 'Parking location updated successfully.',
      data: {
        location,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete or deactivate parking location
 * @route   DELETE /api/parking-locations/:id
 * @access  Private (ADMIN only)
 */
export const deleteLocation = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid location identifier format.',
        errors: [`'${id}' is not a valid MongoDB ObjectId.`],
      });
    }

    const location = await ParkingLocation.findById(id);

    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Parking location not found.',
        errors: [`Location with id '${id}' does not exist.`],
      });
    }

    await location.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Parking location deleted successfully.',
      data: {
        deletedId: id,
      },
    });
  } catch (error) {
    next(error);
  }
};
