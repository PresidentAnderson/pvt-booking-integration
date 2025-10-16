// Application constants

// Booking statuses
const BOOKING_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
  NO_SHOW: 'no_show'
};

// Room statuses
const ROOM_STATUS = {
  AVAILABLE: 'available',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
  CLEANING: 'cleaning',
  OUT_OF_ORDER: 'out_of_order'
};

// Room types
const ROOM_TYPES = {
  PRIVATE: 'private',
  SHARED: 'shared',
  DORM: 'dorm',
  SUITE: 'suite'
};

// User roles
const USER_ROLES = {
  GUEST: 'guest',
  STAFF: 'staff',
  ADMIN: 'admin'
};

// Payment statuses
const PAYMENT_STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded'
};

// Payment methods
const PAYMENT_METHODS = {
  CARD: 'card',
  BANK_TRANSFER: 'bank_transfer',
  PAYPAL: 'paypal',
  CASH: 'cash',
  CRYPTO: 'crypto',
  OTHER: 'other'
};

// Booking sources
const BOOKING_SOURCES = {
  DIRECT: 'direct',
  BOOKING_COM: 'booking_com',
  AIRBNB: 'airbnb',
  HOSTELWORLD: 'hostelworld',
  PHONE: 'phone',
  WALK_IN: 'walk_in',
  API: 'api'
};

// API response messages
const API_MESSAGES = {
  SUCCESS: 'Operation successful',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  NOT_FOUND: 'Resource not found',
  UNAUTHORIZED: 'Unauthorized access',
  FORBIDDEN: 'Forbidden access',
  VALIDATION_ERROR: 'Validation error',
  SERVER_ERROR: 'Internal server error',
  BAD_REQUEST: 'Bad request'
};

// Email templates
const EMAIL_TEMPLATES = {
  BOOKING_CONFIRMATION: 'booking_confirmation',
  BOOKING_CANCELLED: 'booking_cancelled',
  CHECK_IN_REMINDER: 'check_in_reminder',
  PAYMENT_CONFIRMATION: 'payment_confirmation',
  PASSWORD_RESET: 'password_reset',
  WELCOME: 'welcome'
};

// Time constants
const TIME_CONSTANTS = {
  JWT_EXPIRE: '7d',
  REFRESH_TOKEN_EXPIRE: '30d',
  PASSWORD_RESET_EXPIRE: '1h',
  BOOKING_REMINDER_HOURS: 24,
  CHECK_OUT_TIME: '11:00',
  CHECK_IN_TIME: '15:00'
};

// Rate limiting
const RATE_LIMITS = {
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  },
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // limit each IP to 5 auth requests per windowMs
  },
  BOOKING: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10 // limit each IP to 10 booking requests per hour
  }
};

// Validation constants
const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  BOOKING_REFERENCE_LENGTH: 12,
  PHONE_REGEX: /^\+?[\d\s\-\(\)]+$/,
  EMAIL_REGEX: /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/
};

// Business rules
const BUSINESS_RULES = {
  MAX_BOOKING_DAYS: 365,
  MIN_BOOKING_DAYS: 1,
  CANCELLATION_FEES: {
    MORE_THAN_7_DAYS: 0.10, // 10%
    MORE_THAN_2_DAYS: 0.25, // 25%
    MORE_THAN_1_DAY: 0.50,  // 50%
    LESS_THAN_1_DAY: 1.00   // 100%
  },
  DEFAULT_DEPOSIT_PERCENTAGE: 0.20, // 20%
  MAX_GUESTS_PER_BOOKING: 8
};

// Currencies
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

// File upload limits
const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/png']
};

module.exports = {
  BOOKING_STATUS,
  ROOM_STATUS,
  ROOM_TYPES,
  USER_ROLES,
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  BOOKING_SOURCES,
  API_MESSAGES,
  EMAIL_TEMPLATES,
  TIME_CONSTANTS,
  RATE_LIMITS,
  VALIDATION,
  BUSINESS_RULES,
  SUPPORTED_CURRENCIES,
  UPLOAD_LIMITS
};