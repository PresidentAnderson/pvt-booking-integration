const { Room, Booking } = require('../models');
const { API_MESSAGES, ROOM_STATUS } = require('../config/constants');

class RoomController {
  /**
   * Get all rooms with filtering and pagination
   */
  async getAllRooms(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        type,
        status,
        minPrice,
        maxPrice,
        capacity,
        amenities,
        sort = 'roomNumber'
      } = req.query;

      // Build filter object
      const filter = { isActive: true };
      
      if (type) filter.type = type;
      if (status) filter.status = status;
      if (capacity) filter.capacity = { $gte: parseInt(capacity) };
      
      // Price range filtering
      if (minPrice || maxPrice) {
        filter.basePrice = {};
        if (minPrice) filter.basePrice.$gte = parseFloat(minPrice);
        if (maxPrice) filter.basePrice.$lte = parseFloat(maxPrice);
      }
      
      // Amenities filtering
      if (amenities) {
        const amenityArray = Array.isArray(amenities) ? amenities : amenities.split(',');
        filter.amenities = { $all: amenityArray };
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute query
      const rooms = await Room.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await Room.countDocuments(filter);

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: {
          rooms,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      console.error('Get rooms error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Get room by ID
   */
  async getRoomById(req, res) {
    try {
      const { id } = req.params;

      const room = await Room.findById(id).lean();

      if (!room) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Room not found'
        });
      }

      // Add virtual fields
      room.isAvailable = room.status === 'available' && 
                        room.isActive && 
                        room.currentOccupancy < room.capacity;
      
      room.occupancyRate = room.capacity > 0 
        ? (room.currentOccupancy / room.capacity) * 100 
        : 0;

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: { room }
      });

    } catch (error) {
      console.error('Get room error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Create new room (Admin only)
   */
  async createRoom(req, res) {
    try {
      const roomData = req.body;

      // Check if room number already exists
      const existingRoom = await Room.findOne({ 
        roomNumber: roomData.roomNumber 
      });

      if (existingRoom) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Room number already exists'
        });
      }

      const room = new Room(roomData);
      await room.save();

      res.status(201).json({
        success: true,
        message: API_MESSAGES.CREATED,
        data: { room }
      });

    } catch (error) {
      console.error('Create room error:', error);
      
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
   * Update room (Admin only)
   */
  async updateRoom(req, res) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const room = await Room.findById(id);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Room not found'
        });
      }

      // Check if room number is being changed and doesn't conflict
      if (updates.roomNumber && updates.roomNumber !== room.roomNumber) {
        const existingRoom = await Room.findOne({ 
          roomNumber: updates.roomNumber,
          _id: { $ne: id }
        });

        if (existingRoom) {
          return res.status(400).json({
            success: false,
            message: API_MESSAGES.BAD_REQUEST,
            error: 'Room number already exists'
          });
        }
      }

      // Update room
      Object.assign(room, updates);
      await room.save();

      res.json({
        success: true,
        message: API_MESSAGES.UPDATED,
        data: { room }
      });

    } catch (error) {
      console.error('Update room error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Delete room (Admin only)
   */
  async deleteRoom(req, res) {
    try {
      const { id } = req.params;

      const room = await Room.findById(id);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Room not found'
        });
      }

      // Check if room has active bookings
      const activeBookings = await Booking.countDocuments({
        room: id,
        status: { $in: ['confirmed', 'checked_in'] }
      });

      if (activeBookings > 0) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Cannot delete room with active bookings'
        });
      }

      // Soft delete by setting isActive to false
      room.isActive = false;
      await room.save();

      res.json({
        success: true,
        message: API_MESSAGES.DELETED,
        data: { room }
      });

    } catch (error) {
      console.error('Delete room error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Check room availability for specific dates
   */
  async checkAvailability(req, res) {
    try {
      const { id } = req.params;
      const { checkInDate, checkOutDate, guestCount = 1 } = req.query;

      if (!checkInDate || !checkOutDate) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Check-in and check-out dates are required'
        });
      }

      const room = await Room.findById(id);
      if (!room) {
        return res.status(404).json({
          success: false,
          message: API_MESSAGES.NOT_FOUND,
          error: 'Room not found'
        });
      }

      // Check basic availability
      if (!room.isActive || room.status !== ROOM_STATUS.AVAILABLE) {
        return res.json({
          success: true,
          message: API_MESSAGES.SUCCESS,
          data: { 
            available: false,
            reason: 'Room is not available'
          }
        });
      }

      // Check capacity
      if (parseInt(guestCount) > room.capacity) {
        return res.json({
          success: true,
          message: API_MESSAGES.SUCCESS,
          data: { 
            available: false,
            reason: 'Guest count exceeds room capacity'
          }
        });
      }

      // Check date availability
      const available = await room.checkAvailability(
        new Date(checkInDate),
        new Date(checkOutDate)
      );

      // Calculate pricing if available
      let pricing = null;
      if (available) {
        const nights = Math.ceil(
          (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)
        );
        const baseAmount = room.basePrice * nights * parseInt(guestCount);
        const taxes = baseAmount * 0.15;
        
        pricing = {
          basePrice: room.basePrice,
          nights,
          guestCount: parseInt(guestCount),
          baseAmount,
          taxes,
          totalAmount: baseAmount + taxes,
          currency: room.currency
        };
      }

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: { 
          available,
          reason: available ? 'Room is available' : 'Room is not available for selected dates',
          pricing,
          room: {
            id: room._id,
            roomNumber: room.roomNumber,
            type: room.type,
            capacity: room.capacity,
            amenities: room.amenities
          }
        }
      });

    } catch (error) {
      console.error('Check availability error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Search available rooms for specific dates and criteria
   */
  async searchAvailableRooms(req, res) {
    try {
      const {
        checkInDate,
        checkOutDate,
        guestCount = 1,
        type,
        minPrice,
        maxPrice,
        amenities,
        page = 1,
        limit = 20
      } = req.query;

      if (!checkInDate || !checkOutDate) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Check-in and check-out dates are required'
        });
      }

      // Build filter
      const filter = {
        isActive: true,
        status: ROOM_STATUS.AVAILABLE,
        capacity: { $gte: parseInt(guestCount) }
      };

      if (type) filter.type = type;
      
      if (minPrice || maxPrice) {
        filter.basePrice = {};
        if (minPrice) filter.basePrice.$gte = parseFloat(minPrice);
        if (maxPrice) filter.basePrice.$lte = parseFloat(maxPrice);
      }

      if (amenities) {
        const amenityArray = Array.isArray(amenities) ? amenities : amenities.split(',');
        filter.amenities = { $all: amenityArray };
      }

      // Get potentially available rooms
      const rooms = await Room.find(filter);

      // Check actual availability for each room
      const availableRooms = [];
      
      for (const room of rooms) {
        const available = await room.checkAvailability(
          new Date(checkInDate),
          new Date(checkOutDate)
        );

        if (available) {
          // Calculate pricing
          const nights = Math.ceil(
            (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)
          );
          const baseAmount = room.basePrice * nights * parseInt(guestCount);
          const taxes = baseAmount * 0.15;

          const roomData = room.toObject();
          roomData.pricing = {
            basePrice: room.basePrice,
            nights,
            guestCount: parseInt(guestCount),
            baseAmount,
            taxes,
            totalAmount: baseAmount + taxes,
            currency: room.currency
          };

          availableRooms.push(roomData);
        }
      }

      // Apply pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);
      const paginatedRooms = availableRooms.slice(skip, skip + parseInt(limit));

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: {
          rooms: paginatedRooms,
          searchCriteria: {
            checkInDate,
            checkOutDate,
            guestCount: parseInt(guestCount),
            type,
            priceRange: { min: minPrice, max: maxPrice },
            amenities: amenities ? amenities.split(',') : []
          },
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: availableRooms.length,
            pages: Math.ceil(availableRooms.length / parseInt(limit))
          }
        }
      });

    } catch (error) {
      console.error('Search rooms error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Get room occupancy statistics
   */
  async getRoomStats(req, res) {
    try {
      const { startDate, endDate } = req.query;
      
      // Default to current month if no dates provided
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate ? new Date(startDate) : new Date(end.getFullYear(), end.getMonth(), 1);

      // Get room statistics
      const totalRooms = await Room.countDocuments({ isActive: true });
      const occupiedRooms = await Room.countDocuments({ 
        isActive: true, 
        status: ROOM_STATUS.OCCUPIED 
      });
      const maintenanceRooms = await Room.countDocuments({ 
        isActive: true, 
        status: ROOM_STATUS.MAINTENANCE 
      });

      // Get booking statistics for the period
      const bookings = await Booking.aggregate([
        {
          $match: {
            checkInDate: { $gte: start, $lte: end },
            status: { $ne: 'cancelled' }
          }
        },
        {
          $group: {
            _id: '$room',
            bookings: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.totalAmount' },
            totalNights: {
              $sum: {
                $divide: [
                  { $subtract: ['$checkOutDate', '$checkInDate'] },
                  86400000 // milliseconds in a day
                ]
              }
            }
          }
        },
        {
          $lookup: {
            from: 'rooms',
            localField: '_id',
            foreignField: '_id',
            as: 'room'
          }
        },
        {
          $unwind: '$room'
        }
      ]);

      // Calculate overall occupancy rate
      const totalCapacity = await Room.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, totalCapacity: { $sum: '$capacity' } } }
      ]);

      const currentOccupancy = await Room.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, currentOccupancy: { $sum: '$currentOccupancy' } } }
      ]);

      const occupancyRate = totalCapacity[0] && currentOccupancy[0]
        ? (currentOccupancy[0].currentOccupancy / totalCapacity[0].totalCapacity) * 100
        : 0;

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: {
          overview: {
            totalRooms,
            occupiedRooms,
            availableRooms: totalRooms - occupiedRooms - maintenanceRooms,
            maintenanceRooms,
            occupancyRate: Math.round(occupancyRate * 100) / 100
          },
          roomPerformance: bookings,
          period: { start, end }
        }
      });

    } catch (error) {
      console.error('Room stats error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }
}

module.exports = new RoomController();