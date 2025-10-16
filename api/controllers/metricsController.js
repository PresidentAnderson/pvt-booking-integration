const { Booking, Room, Payment, User } = require('../models');
const { API_MESSAGES } = require('../config/constants');

class MetricsController {
  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(req, res) {
    try {
      const { period = '30' } = req.query; // Days
      const daysBack = parseInt(period);
      
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Run all metrics queries in parallel
      const [
        bookingMetrics,
        revenueMetrics,
        roomMetrics,
        userMetrics,
        occupancyData,
        recentActivity
      ] = await Promise.all([
        this.getBookingMetrics(startDate, endDate),
        this.getRevenueMetrics(startDate, endDate),
        this.getRoomMetrics(),
        this.getUserMetrics(startDate, endDate),
        this.getOccupancyData(startDate, endDate),
        this.getRecentActivity(5)
      ]);

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: {
          period: { start: startDate, end: endDate, days: daysBack },
          bookings: bookingMetrics,
          revenue: revenueMetrics,
          rooms: roomMetrics,
          users: userMetrics,
          occupancy: occupancyData,
          recentActivity,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Dashboard metrics error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Get booking-related metrics
   */
  async getBookingMetrics(startDate, endDate) {
    const pipeline = [
      {
        $facet: {
          // Current period bookings
          current: [
            {
              $match: {
                createdAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                confirmedBookings: {
                  $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
                },
                cancelledBookings: {
                  $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                },
                checkedInBookings: {
                  $sum: { $cond: [{ $eq: ['$status', 'checked_in'] }, 1, 0] }
                },
                checkedOutBookings: {
                  $sum: { $cond: [{ $eq: ['$status', 'checked_out'] }, 1, 0] }
                },
                averageStayDays: {
                  $avg: {
                    $divide: [
                      { $subtract: ['$checkOutDate', '$checkInDate'] },
                      86400000 // milliseconds in a day
                    ]
                  }
                },
                totalGuests: { $sum: '$guestCount' },
                averageBookingValue: { $avg: '$pricing.totalAmount' }
              }
            }
          ],
          
          // Previous period for comparison
          previous: [
            {
              $match: {
                createdAt: { 
                  $gte: new Date(startDate.getTime() - (endDate - startDate)),
                  $lt: startDate
                }
              }
            },
            {
              $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                totalGuests: { $sum: '$guestCount' },
                averageBookingValue: { $avg: '$pricing.totalAmount' }
              }
            }
          ],

          // Status breakdown
          statusBreakdown: [
            {
              $match: {
                createdAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],

          // Daily bookings trend
          dailyTrend: [
            {
              $match: {
                createdAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                  day: { $dayOfMonth: '$createdAt' }
                },
                count: { $sum: 1 }
              }
            },
            {
              $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
          ]
        }
      }
    ];

    const result = await Booking.aggregate(pipeline);
    const data = result[0];

    const current = data.current[0] || {
      totalBookings: 0,
      confirmedBookings: 0,
      cancelledBookings: 0,
      checkedInBookings: 0,
      checkedOutBookings: 0,
      averageStayDays: 0,
      totalGuests: 0,
      averageBookingValue: 0
    };

    const previous = data.previous[0] || {
      totalBookings: 0,
      totalGuests: 0,
      averageBookingValue: 0
    };

    return {
      total: current.totalBookings,
      confirmed: current.confirmedBookings,
      cancelled: current.cancelledBookings,
      checkedIn: current.checkedInBookings,
      checkedOut: current.checkedOutBookings,
      averageStayDays: Math.round(current.averageStayDays * 10) / 10,
      totalGuests: current.totalGuests,
      averageBookingValue: Math.round(current.averageBookingValue * 100) / 100,
      statusBreakdown: data.statusBreakdown,
      dailyTrend: data.dailyTrend,
      growth: {
        bookings: this.calculateGrowth(current.totalBookings, previous.totalBookings),
        guests: this.calculateGrowth(current.totalGuests, previous.totalGuests),
        averageValue: this.calculateGrowth(current.averageBookingValue, previous.averageBookingValue)
      }
    };
  }

  /**
   * Get revenue-related metrics
   */
  async getRevenueMetrics(startDate, endDate) {
    const pipeline = [
      {
        $facet: {
          // Current period revenue
          current: [
            {
              $match: {
                status: 'succeeded',
                createdAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$amount' },
                totalTransactions: { $sum: 1 },
                averageTransactionValue: { $avg: '$amount' },
                totalFees: { $sum: '$fees.total' },
                netRevenue: { $sum: { $subtract: ['$amount', '$fees.total'] } }
              }
            }
          ],

          // Previous period for comparison
          previous: [
            {
              $match: {
                status: 'succeeded',
                createdAt: { 
                  $gte: new Date(startDate.getTime() - (endDate - startDate)),
                  $lt: startDate
                }
              }
            },
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$amount' },
                totalTransactions: { $sum: 1 }
              }
            }
          ],

          // Daily revenue trend
          dailyRevenue: [
            {
              $match: {
                status: 'succeeded',
                createdAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: {
                  year: { $year: '$createdAt' },
                  month: { $month: '$createdAt' },
                  day: { $dayOfMonth: '$createdAt' }
                },
                revenue: { $sum: '$amount' },
                transactions: { $sum: 1 }
              }
            },
            {
              $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
          ],

          // Payment method breakdown
          paymentMethods: [
            {
              $match: {
                status: 'succeeded',
                createdAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: '$paymentMethod.type',
                count: { $sum: 1 },
                revenue: { $sum: '$amount' }
              }
            }
          ]
        }
      }
    ];

    const result = await Payment.aggregate(pipeline);
    const data = result[0];

    const current = data.current[0] || {
      totalRevenue: 0,
      totalTransactions: 0,
      averageTransactionValue: 0,
      totalFees: 0,
      netRevenue: 0
    };

    const previous = data.previous[0] || {
      totalRevenue: 0,
      totalTransactions: 0
    };

    return {
      totalRevenue: Math.round(current.totalRevenue * 100) / 100,
      netRevenue: Math.round(current.netRevenue * 100) / 100,
      totalTransactions: current.totalTransactions,
      averageTransactionValue: Math.round(current.averageTransactionValue * 100) / 100,
      totalFees: Math.round(current.totalFees * 100) / 100,
      dailyRevenue: data.dailyRevenue,
      paymentMethods: data.paymentMethods,
      growth: {
        revenue: this.calculateGrowth(current.totalRevenue, previous.totalRevenue),
        transactions: this.calculateGrowth(current.totalTransactions, previous.totalTransactions)
      }
    };
  }

  /**
   * Get room-related metrics
   */
  async getRoomMetrics() {
    const pipeline = [
      {
        $facet: {
          overview: [
            {
              $group: {
                _id: null,
                totalRooms: { $sum: { $cond: ['$isActive', 1, 0] } },
                availableRooms: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
                occupiedRooms: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
                maintenanceRooms: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
                totalCapacity: { $sum: { $cond: ['$isActive', '$capacity', 0] } },
                currentOccupancy: { $sum: { $cond: ['$isActive', '$currentOccupancy', 0] } },
                averagePrice: { $avg: { $cond: ['$isActive', '$basePrice', null] } }
              }
            }
          ],

          typeBreakdown: [
            {
              $match: { isActive: true }
            },
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
                totalCapacity: { $sum: '$capacity' },
                currentOccupancy: { $sum: '$currentOccupancy' },
                averagePrice: { $avg: '$basePrice' }
              }
            }
          ],

          statusBreakdown: [
            {
              $match: { isActive: true }
            },
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ];

    const result = await Room.aggregate(pipeline);
    const data = result[0];

    const overview = data.overview[0] || {
      totalRooms: 0,
      availableRooms: 0,
      occupiedRooms: 0,
      maintenanceRooms: 0,
      totalCapacity: 0,
      currentOccupancy: 0,
      averagePrice: 0
    };

    const occupancyRate = overview.totalCapacity > 0 
      ? (overview.currentOccupancy / overview.totalCapacity) * 100 
      : 0;

    return {
      total: overview.totalRooms,
      available: overview.availableRooms,
      occupied: overview.occupiedRooms,
      maintenance: overview.maintenanceRooms,
      totalCapacity: overview.totalCapacity,
      currentOccupancy: overview.currentOccupancy,
      occupancyRate: Math.round(occupancyRate * 100) / 100,
      averagePrice: Math.round(overview.averagePrice * 100) / 100,
      typeBreakdown: data.typeBreakdown,
      statusBreakdown: data.statusBreakdown
    };
  }

  /**
   * Get user-related metrics
   */
  async getUserMetrics(startDate, endDate) {
    const pipeline = [
      {
        $facet: {
          current: [
            {
              $match: {
                createdAt: { $gte: startDate, $lte: endDate }
              }
            },
            {
              $group: {
                _id: null,
                newUsers: { $sum: 1 }
              }
            }
          ],

          total: [
            {
              $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } }
              }
            }
          ],

          roleBreakdown: [
            {
              $match: { isActive: true }
            },
            {
              $group: {
                _id: '$role',
                count: { $sum: 1 }
              }
            }
          ]
        }
      }
    ];

    const result = await User.aggregate(pipeline);
    const data = result[0];

    const current = data.current[0] || { newUsers: 0 };
    const total = data.total[0] || { totalUsers: 0, activeUsers: 0 };

    return {
      total: total.totalUsers,
      active: total.activeUsers,
      newUsers: current.newUsers,
      roleBreakdown: data.roleBreakdown
    };
  }

  /**
   * Get occupancy data over time
   */
  async getOccupancyData(startDate, endDate) {
    // This is a simplified version - in production, you might want to store daily snapshots
    const totalCapacity = await Room.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: null, total: { $sum: '$capacity' } } }
    ]);

    const capacity = totalCapacity[0]?.total || 0;

    // Get daily occupancy based on checked-in bookings
    const occupancyData = await Booking.aggregate([
      {
        $match: {
          status: 'checked_in',
          checkInDate: { $lte: endDate },
          checkOutDate: { $gte: startDate }
        }
      },
      {
        $project: {
          dates: {
            $range: [
              { $max: ['$checkInDate', startDate] },
              { $min: ['$checkOutDate', endDate] },
              86400000 // 1 day in milliseconds
            ]
          },
          guestCount: 1
        }
      },
      {
        $unwind: '$dates'
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$dates' }
          },
          occupancy: { $sum: '$guestCount' }
        }
      },
      {
        $sort: { '_id': 1 }
      }
    ]);

    const occupancyRates = occupancyData.map(day => ({
      date: day._id,
      occupancy: day.occupancy,
      capacity,
      rate: capacity > 0 ? Math.round((day.occupancy / capacity) * 10000) / 100 : 0
    }));

    return {
      totalCapacity: capacity,
      daily: occupancyRates,
      averageOccupancy: occupancyRates.length > 0
        ? occupancyRates.reduce((sum, day) => sum + day.rate, 0) / occupancyRates.length
        : 0
    };
  }

  /**
   * Get recent activity
   */
  async getRecentActivity(limit = 10) {
    const [recentBookings, recentPayments] = await Promise.all([
      Booking.find()
        .populate('user', 'firstName lastName')
        .populate('room', 'roomNumber type')
        .sort('-createdAt')
        .limit(limit)
        .lean(),
      
      Payment.find({ status: 'succeeded' })
        .populate('user', 'firstName lastName')
        .populate('booking', 'bookingReference')
        .sort('-createdAt')
        .limit(limit)
        .lean()
    ]);

    const activity = [];

    recentBookings.forEach(booking => {
      activity.push({
        type: 'booking',
        action: `New booking created`,
        details: `${booking.user?.firstName} ${booking.user?.lastName} booked ${booking.room?.roomNumber}`,
        timestamp: booking.createdAt,
        amount: booking.pricing?.totalAmount
      });
    });

    recentPayments.forEach(payment => {
      activity.push({
        type: 'payment',
        action: 'Payment received',
        details: `${payment.user?.firstName} ${payment.user?.lastName} paid for ${payment.booking?.bookingReference}`,
        timestamp: payment.createdAt,
        amount: payment.amount
      });
    });

    return activity
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Calculate growth percentage
   */
  calculateGrowth(current, previous) {
    if (!previous || previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }

  /**
   * Get custom metrics for specific date range
   */
  async getCustomMetrics(req, res) {
    try {
      const { startDate, endDate, metrics } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Start date and end date are required'
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      const requestedMetrics = metrics ? metrics.split(',') : ['bookings', 'revenue'];

      const result = {};

      if (requestedMetrics.includes('bookings')) {
        result.bookings = await this.getBookingMetrics(start, end);
      }

      if (requestedMetrics.includes('revenue')) {
        result.revenue = await this.getRevenueMetrics(start, end);
      }

      if (requestedMetrics.includes('rooms')) {
        result.rooms = await this.getRoomMetrics();
      }

      if (requestedMetrics.includes('users')) {
        result.users = await this.getUserMetrics(start, end);
      }

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: {
          period: { start, end },
          metrics: result,
          generatedAt: new Date()
        }
      });

    } catch (error) {
      console.error('Custom metrics error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }
}

module.exports = new MetricsController();