/**
 * Role-Based Access Control (RBAC) Middleware
 * Restricts endpoint access to specific roles ('USER', 'STAFF', 'ADMIN')
 * @param  {...string} roles - Permitted user roles
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Authentication required before checking permissions.',
        errors: ['User context not found on request.'],
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient privileges to perform this action.',
        errors: [
          `Your role (${req.user.role}) is not authorized for this resource. Required: [${roles.join(', ')}].`,
        ],
      });
    }

    next();
  };
};
