/**
 * Higher-order middleware that runs a validator function on req.body
 * @param {Function} validatorFn - Function returning { isValid, errors }
 */
export const validate = (validatorFn) => {
  return (req, res, next) => {
    const { isValid, errors } = validatorFn(req.body);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed. Please correct the input errors.',
        errors,
      });
    }

    next();
  };
};
