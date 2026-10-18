import PricingRule from '../models/PricingRule.js';

export const getPricingRules = async (req, res, next) => {
  try {
    const pricing = await PricingRule.find({}).sort({ vehicleType: 1 });

    res.status(200).json({
      success: true,
      message: 'Pricing rules retrieved successfully.',
      data: { pricing },
    });
  } catch (error) {
    next(error);
  }
};

export const createPricingRule = async (req, res, next) => {
  try {
    const { vehicleType, pricePerHour } = req.body;

    if (!vehicleType || typeof pricePerHour !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Vehicle type and price per hour are required.',
        errors: ['vehicleType and pricePerHour are required fields.'],
      });
    }

    const rule = await PricingRule.create({
      vehicleType: vehicleType.toUpperCase(),
      pricePerHour,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: 'Pricing rule created successfully.',
      data: { pricingRule: rule },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePricingRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { pricePerHour, isActive } = req.body;

    const rule = await PricingRule.findById(id);
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Pricing rule not found.',
        errors: [`Pricing rule with id '${id}' does not exist.`],
      });
    }

    if (pricePerHour !== undefined) rule.pricePerHour = pricePerHour;
    if (isActive !== undefined) rule.isActive = isActive;

    await rule.save();

    res.status(200).json({
      success: true,
      message: 'Pricing rule updated successfully.',
      data: { pricingRule: rule },
    });
  } catch (error) {
    next(error);
  }
};
