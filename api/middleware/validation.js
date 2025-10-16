const { validationResult, body, param, query } = require('express-validator');
const { API_MESSAGES, VALIDATION } = require('../config/constants');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: API_MESSAGES.VALIDATION_ERROR,
      errors: errorMessages
    });
  }
  
  next();
};

/**
 * User registration validation
 */
const validateUserRegistration = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .isLength({ min: VALIDATION.PASSWORD_MIN_LENGTH })
    .withMessage(`Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  
  body('phone')
    .optional()
    .matches(VALIDATION.PHONE_REGEX)
    .withMessage('Please provide a valid phone number'),
  
  handleValidationErrors
];

/**
 * User login validation
 */
const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

/**
 * Booking creation validation
 */
const validateBookingCreation = [
  body('roomId')
    .isMongoId()
    .withMessage('Valid room ID is required'),
  
  body('checkInDate')
    .isISO8601()
    .toDate()
    .withMessage('Valid check-in date is required'),
  
  body('checkOutDate')
    .isISO8601()
    .toDate()
    .withMessage('Valid check-out date is required')
    .custom((checkOutDate, { req }) => {
      if (new Date(checkOutDate) <= new Date(req.body.checkInDate)) {
        throw new Error('Check-out date must be after check-in date');
      }
      return true;
    }),
  
  body('guestCount')
    .isInt({ min: 1, max: 20 })
    .withMessage('Guest count must be between 1 and 20'),
  
  body('guestDetails.primaryGuest.firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Primary guest first name is required'),
  
  body('guestDetails.primaryGuest.lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Primary guest last name is required'),
  
  body('guestDetails.primaryGuest.email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Primary guest email is required'),
  
  body('guestDetails.primaryGuest.phone')
    .optional()
    .matches(VALIDATION.PHONE_REGEX)
    .withMessage('Please provide a valid phone number'),
  
  handleValidationErrors
];

/**
 * Booking update validation
 */
const validateBookingUpdate = [
  param('id')
    .isMongoId()
    .withMessage('Valid booking ID is required'),
  
  body('checkInDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Valid check-in date is required'),
  
  body('checkOutDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Valid check-out date is required'),
  
  body('guestCount')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Guest count must be between 1 and 20'),
  
  handleValidationErrors
];

/**
 * Room creation validation
 */
const validateRoomCreation = [
  body('roomNumber')
    .trim()
    .isLength({ min: 1, max: 10 })
    .withMessage('Room number is required'),
  
  body('type')
    .isIn(['private', 'shared', 'dorm', 'suite'])
    .withMessage('Valid room type is required'),
  
  body('capacity')
    .isInt({ min: 1, max: 20 })
    .withMessage('Capacity must be between 1 and 20'),
  
  body('basePrice')
    .isNumeric({ min: 0 })
    .withMessage('Base price must be a positive number'),
  
  handleValidationErrors
];

/**
 * Payment validation
 */
const validatePayment = [
  body('bookingId')
    .isMongoId()
    .withMessage('Valid booking ID is required'),
  
  body('amount')
    .isNumeric({ min: 0.01 })
    .withMessage('Amount must be greater than 0'),
  
  body('currency')
    .optional()
    .isLength({ min: 3, max: 3 })
    .withMessage('Currency must be 3 characters'),
  
  handleValidationErrors
];

/**
 * Query parameter validation for listings
 */
const validateListingQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('sort')
    .optional()
    .isIn(['createdAt', '-createdAt', 'updatedAt', '-updatedAt', 'name', '-name'])
    .withMessage('Invalid sort parameter'),
  
  handleValidationErrors
];

/**
 * Date range validation
 */
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Valid start date is required'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Valid end date is required')
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(endDate) <= new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
  handleValidationErrors
];

/**
 * MongoDB ObjectId validation
 */
const validateMongoId = (field = 'id') => [
  param(field)
    .isMongoId()
    .withMessage(`Valid ${field} is required`),
  
  handleValidationErrors
];

/**
 * Email validation
 */
const validateEmail = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  handleValidationErrors
];

/**
 * Password validation
 */
const validatePassword = [
  body('password')
    .isLength({ min: VALIDATION.PASSWORD_MIN_LENGTH })
    .withMessage(`Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`)
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  
  handleValidationErrors
];

/**
 * Custom validation for business rules
 */
const validateBusinessRules = {
  // Check if booking dates are in the future
  futureBookingDates: (req, res, next) => {
    const { checkInDate } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (new Date(checkInDate) < today) {
      return res.status(400).json({
        success: false,
        message: API_MESSAGES.VALIDATION_ERROR,
        errors: [{ field: 'checkInDate', message: 'Check-in date cannot be in the past' }]
      });
    }
    
    next();
  },
  
  // Check maximum booking duration
  maxBookingDuration: (req, res, next) => {
    const { checkInDate, checkOutDate } = req.body;
    const diffTime = Math.abs(new Date(checkOutDate) - new Date(checkInDate));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 365) { // Max 1 year
      return res.status(400).json({
        success: false,
        message: API_MESSAGES.VALIDATION_ERROR,
        errors: [{ field: 'checkOutDate', message: 'Booking cannot exceed 365 days' }]
      });
    }
    
    next();
  }
};

module.exports = {
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateBookingCreation,
  validateBookingUpdate,
  validateRoomCreation,
  validatePayment,
  validateListingQuery,
  validateDateRange,
  validateMongoId,
  validateEmail,
  validatePassword,
  validateBusinessRules
};