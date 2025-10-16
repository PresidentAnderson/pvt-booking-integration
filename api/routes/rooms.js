const express = require('express');
const router = express.Router();

const roomController = require('../controllers/roomController');
const { authenticate, adminOnly, staffOrAdmin, optionalAuth } = require('../middleware/auth');
const {
  validateRoomCreation,
  validateListingQuery,
  validateDateRange,
  validateMongoId
} = require('../middleware/validation');

/**
 * @route   GET /api/rooms
 * @desc    Get all rooms with filtering
 * @access  Public
 */
router.get(
  '/',
  optionalAuth,
  validateListingQuery,
  roomController.getAllRooms
);

/**
 * @route   GET /api/rooms/search
 * @desc    Search available rooms for specific dates
 * @access  Public
 */
router.get(
  '/search',
  validateDateRange,
  validateListingQuery,
  roomController.searchAvailableRooms
);

/**
 * @route   GET /api/rooms/stats
 * @desc    Get room occupancy statistics
 * @access  Private (Staff and Admin only)
 */
router.get(
  '/stats',
  authenticate,
  staffOrAdmin,
  validateDateRange,
  roomController.getRoomStats
);

/**
 * @route   POST /api/rooms
 * @desc    Create new room
 * @access  Private (Admin only)
 */
router.post(
  '/',
  authenticate,
  adminOnly,
  validateRoomCreation,
  roomController.createRoom
);

/**
 * @route   GET /api/rooms/:id
 * @desc    Get room by ID
 * @access  Public
 */
router.get(
  '/:id',
  validateMongoId('id'),
  roomController.getRoomById
);

/**
 * @route   PUT /api/rooms/:id
 * @desc    Update room
 * @access  Private (Admin only)
 */
router.put(
  '/:id',
  authenticate,
  adminOnly,
  validateMongoId('id'),
  roomController.updateRoom
);

/**
 * @route   DELETE /api/rooms/:id
 * @desc    Delete room (soft delete)
 * @access  Private (Admin only)
 */
router.delete(
  '/:id',
  authenticate,
  adminOnly,
  validateMongoId('id'),
  roomController.deleteRoom
);

/**
 * @route   GET /api/rooms/:id/availability
 * @desc    Check room availability for specific dates
 * @access  Public
 */
router.get(
  '/:id/availability',
  validateMongoId('id'),
  roomController.checkAvailability
);

module.exports = router;