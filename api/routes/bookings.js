const express = require('express');
const router = express.Router();

const bookingController = require('../controllers/bookingController');
const { authenticate, authorize, staffOrAdmin } = require('../middleware/auth');
const {
  validateBookingCreation,
  validateBookingUpdate,
  validateListingQuery,
  validateDateRange,
  validateMongoId
} = require('../middleware/validation');

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route   GET /api/bookings
 * @desc    Get all bookings with filtering and pagination
 * @access  Private (All authenticated users, guests see only their bookings)
 */
router.get(
  '/',
  validateListingQuery,
  validateDateRange,
  bookingController.getAllBookings
);

/**
 * @route   POST /api/bookings
 * @desc    Create new booking
 * @access  Private (All authenticated users)
 */
router.post(
  '/',
  validateBookingCreation,
  bookingController.createBooking
);

/**
 * @route   GET /api/bookings/analytics
 * @desc    Get booking analytics
 * @access  Private (Staff and Admin only)
 */
router.get(
  '/analytics',
  staffOrAdmin,
  validateDateRange,
  bookingController.getBookingAnalytics
);

/**
 * @route   GET /api/bookings/:id
 * @desc    Get booking by ID
 * @access  Private (Owner, Staff, Admin)
 */
router.get(
  '/:id',
  validateMongoId('id'),
  bookingController.getBookingById
);

/**
 * @route   PUT /api/bookings/:id
 * @desc    Update booking
 * @access  Private (Owner, Staff, Admin)
 */
router.put(
  '/:id',
  validateMongoId('id'),
  validateBookingUpdate,
  bookingController.updateBooking
);

/**
 * @route   DELETE /api/bookings/:id
 * @desc    Cancel booking
 * @access  Private (Owner, Staff, Admin)
 */
router.delete(
  '/:id',
  validateMongoId('id'),
  bookingController.cancelBooking
);

/**
 * @route   POST /api/bookings/:id/checkin
 * @desc    Check-in guest
 * @access  Private (Staff and Admin only)
 */
router.post(
  '/:id/checkin',
  validateMongoId('id'),
  staffOrAdmin,
  bookingController.checkIn
);

/**
 * @route   POST /api/bookings/:id/checkout
 * @desc    Check-out guest
 * @access  Private (Staff and Admin only)
 */
router.post(
  '/:id/checkout',
  validateMongoId('id'),
  staffOrAdmin,
  bookingController.checkOut
);

module.exports = router;