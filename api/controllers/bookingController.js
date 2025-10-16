const { Booking, Room, User } = require('../models');
const { API_MESSAGES, BOOKING_STATUS } = require('../config/constants');

class BookingController {
  /**
   * Get all bookings with filtering and pagination
   */
  async getAllBookings(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        roomId,
        userId,
        checkInDate,
        checkOutDate,
        sort = '-createdAt'
      } = req.query;

      // Build filter object
      const filter = {};
      
      if (status) filter.status = status;
      if (roomId) filter.room = roomId;
      if (userId) filter.user = userId;
      
      // Date range filtering
      if (checkInDate || checkOutDate) {
        filter.$and = [];
        if (checkInDate) {
          filter.$and.push({ checkInDate: { $gte: new Date(checkInDate) } });
        }
        if (checkOutDate) {
          filter.$and.push({ checkOutDate: { $lte: new Date(checkOutDate) } });
        }
      }

      // User role-based filtering
      if (req.user.role === 'guest') {
        filter.user = req.user._id;
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute query with population
      const bookings = await Booking.find(filter)
        .populate('user', 'firstName lastName email phone')
        .populate('room', 'roomNumber type basePrice amenities')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await Booking.countDocuments(filter);

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: {
          bookings,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      console.error('Get bookings error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Get booking by ID
   */
  async getBookingById(req, res) {
    try {
      const { id } = req.params;

      const booking = await Booking.findById(id)
        .populate('user', 'firstName lastName email phone profile')
        .populate('room', 'roomNumber type basePrice amenities description images')
        .lean();

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Booking not found'
        });
      }

      // Check access permissions
      if (req.user.role === 'guest' && booking.user._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: API_MESSAGES.FORBIDDEN,
          error: 'Access denied to this booking'
        });
      }

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: { booking }
      });

    } catch (error) {
      console.error('Get booking error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Create new booking
   */
  async createBooking(req, res) {
    try {
      const {
        roomId,
        checkInDate,
        checkOutDate,
        guestCount,
        guestDetails,
        specialRequests,
        source = 'direct'
      } = req.body;

      // Check room availability
      const room = await Room.findById(roomId);
      if (!room || !room.isActive) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Room not available'
        });
      }

      // Check capacity
      if (guestCount > room.capacity) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Guest count exceeds room capacity'
        });
      }

      // Check for conflicts
      const isAvailable = await room.checkAvailability(
        new Date(checkInDate),
        new Date(checkOutDate)
      );

      if (!isAvailable) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Room not available for selected dates'
        });
      }

      // Calculate pricing
      const nights = Math.ceil(
        (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)
      );
      const baseAmount = room.basePrice * nights * guestCount;
      const taxes = baseAmount * 0.15; // 15% tax
      const totalAmount = baseAmount + taxes;

      // Create booking
      const bookingData = {
        user: req.user._id,
        room: roomId,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
        guestCount,
        guestDetails,
        specialRequests: specialRequests || [],
        source,
        pricing: {
          baseAmount,
          taxes,
          fees: {
            cleaning: 0,
            service: 0,
            deposit: 0
          },
          discounts: {
            amount: 0
          },
          totalAmount
        },
        payment: {
          status: 'pending',
          remainingAmount: totalAmount
        }
      };

      const booking = new Booking(bookingData);
      await booking.save();

      // Populate for response
      await booking.populate('user', 'firstName lastName email phone');
      await booking.populate('room', 'roomNumber type basePrice amenities');

      res.status(201).json({
        success: true,
        message: API_MESSAGES.CREATED,
        data: { booking }
      });

    } catch (error) {
      console.error('Create booking error:', error);
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map(err => ({
          field: err.path,
          message: err.message
        }));
        
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.VALIDATION_ERROR,
          errors: validationErrors
        });
      }

      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Update booking
   */
  async updateBooking(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Booking not found'
        });
      }

      // Check permissions
      if (req.user.role === 'guest' && booking.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: API_MESSAGES.FORBIDDEN,
          error: 'Access denied to this booking'
        });
      }

      // Check if booking can be modified
      if (!booking.canModify()) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Booking cannot be modified at this time'
        });
      }

      // Handle date changes
      if (updates.checkInDate || updates.checkOutDate) {
        const newCheckIn = updates.checkInDate ? new Date(updates.checkInDate) : booking.checkInDate;
        const newCheckOut = updates.checkOutDate ? new Date(updates.checkOutDate) : booking.checkOutDate;

        // Check room availability for new dates
        const room = await Room.findById(booking.room);
        const isAvailable = await room.checkAvailability(newCheckIn, newCheckOut, booking._id);

        if (!isAvailable) {
          return res.status(400).json({
            success: false,
            message: API_MESSAGES.BAD_REQUEST,
            error: 'Room not available for selected dates'
          });
        }

        // Recalculate pricing if dates changed
        if (updates.checkInDate || updates.checkOutDate) {
          const nights = Math.ceil((newCheckOut - newCheckIn) / (1000 * 60 * 60 * 24));
          const guestCount = updates.guestCount || booking.guestCount;
          const baseAmount = room.basePrice * nights * guestCount;
          const taxes = baseAmount * 0.15;
          const totalAmount = baseAmount + taxes;

          updates.pricing = {
            ...booking.pricing,
            baseAmount,
            taxes,
            totalAmount
          };
          updates.payment = {
            ...booking.payment,
            remainingAmount: totalAmount - booking.payment.paidAmount
          };
        }
      }

      // Update booking
      Object.assign(booking, updates);
      await booking.save();

      // Populate for response
      await booking.populate('user', 'firstName lastName email phone');
      await booking.populate('room', 'roomNumber type basePrice amenities');

      res.json({
        success: true,
        message: API_MESSAGES.UPDATED,
        data: { booking }
      });

    } catch (error) {
      console.error('Update booking error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Cancel booking
   */
  async cancelBooking(req, res) {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Booking not found'
        });
      }

      // Check permissions
      if (req.user.role === 'guest' && booking.user.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: API_MESSAGES.FORBIDDEN,
          error: 'Access denied to this booking'
        });
      }

      // Check if booking can be cancelled
      if (!['pending', 'confirmed'].includes(booking.status)) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Booking cannot be cancelled'
        });
      }

      // Calculate cancellation fee
      const cancellationFee = booking.calculateCancellationFee();
      const refundAmount = Math.max(0, booking.payment.paidAmount - cancellationFee);

      // Update booking
      booking.status = BOOKING_STATUS.CANCELLED;
      booking.cancellation = {
        cancelledAt: new Date(),
        cancelledBy: req.user._id,
        reason: reason || 'Cancelled by user',
        refundAmount
      };

      await booking.save();

      // TODO: Process refund if payment was made
      // TODO: Send cancellation email

      res.json({
        success: true,
        message: 'Booking cancelled successfully',
        data: { 
          booking,
          cancellationFee,
          refundAmount
        }
      });

    } catch (error) {
      console.error('Cancel booking error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Check-in guest
   */
  async checkIn(req, res) {
    try {
      const { id } = req.params;

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Booking not found'
        });
      }

      // Only staff and admin can check-in guests
      if (!['staff', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: API_MESSAGES.FORBIDDEN,
          error: 'Only staff can check-in guests'
        });
      }

      // Check if booking can be checked in
      if (booking.status !== BOOKING_STATUS.CONFIRMED) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Only confirmed bookings can be checked in'
        });
      }

      // Check if check-in is on the right date
      const today = new Date();
      const checkInDate = new Date(booking.checkInDate);
      const daysDiff = Math.floor((today - checkInDate) / (1000 * 60 * 60 * 24));

      if (daysDiff < -1) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Check-in is too early'
        });
      }

      // Update booking status
      booking.status = BOOKING_STATUS.CHECKED_IN;
      booking.actualCheckIn = new Date();
      booking.checkInProcess = {
        documentsVerified: true,
        depositCollected: true,
        keyIssued: true,
        orientationCompleted: true,
        processedBy: req.user._id
      };

      await booking.save();

      // Update room occupancy
      const room = await Room.findById(booking.room);
      await room.updateOccupancy();

      res.json({
        success: true,
        message: 'Guest checked in successfully',
        data: { booking }
      });

    } catch (error) {
      console.error('Check-in error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Check-out guest
   */
  async checkOut(req, res) {
    try {
      const { id } = req.params;
      const { damagesNoted, depositReturned = true } = req.body;

      const booking = await Booking.findById(id);
      if (!booking) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Booking not found'
        });
      }

      // Only staff and admin can check-out guests
      if (!['staff', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: API_MESSAGES.FORBIDDEN,
          error: 'Only staff can check-out guests'
        });
      }

      // Check if booking can be checked out
      if (booking.status !== BOOKING_STATUS.CHECKED_IN) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Only checked-in bookings can be checked out'
        });
      }

      // Update booking status
      booking.status = BOOKING_STATUS.CHECKED_OUT;
      booking.actualCheckOut = new Date();
      booking.checkOutProcess = {
        roomInspected: true,
        damagesNoted: damagesNoted || '',
        depositReturned,
        keyReturned: true,
        processedBy: req.user._id
      };

      await booking.save();

      // Update room occupancy
      const room = await Room.findById(booking.room);
      await room.updateOccupancy();

      res.json({
        success: true,
        message: 'Guest checked out successfully',
        data: { booking }
      });

    } catch (error) {
      console.error('Check-out error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Get booking analytics
   */
  async getBookingAnalytics(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      // Default to last 30 days if no dates provided
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const analytics = await Booking.getAnalytics(start, end);

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: { 
          analytics: analytics[0] || {
            totalBookings: 0,
            totalRevenue: 0,
            averageStay: 0,
            statusBreakdown: []
          },
          period: { start, end }
        }
      });

    } catch (error) {
      console.error('Booking analytics error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }
}

module.exports = new BookingController();