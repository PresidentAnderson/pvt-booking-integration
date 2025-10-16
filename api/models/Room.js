const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['private', 'shared', 'dorm', 'suite'],
    index: true
  },
  capacity: {
    type: Number,
    required: true,
    min: 1,
    max: 20
  },
  currentOccupancy: {
    type: Number,
    default: 0,
    min: 0
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  amenities: [{
    type: String,
    enum: [
      'wifi', 'ac', 'heating', 'tv', 'minibar', 'balcony', 
      'bathroom', 'shared_bathroom', 'kitchen', 'shared_kitchen',
      'locker', 'desk', 'window', 'safe', 'towels', 'bedding'
    ]
  }],
  images: [{
    url: { type: String, required: true },
    alt: String,
    isPrimary: { type: Boolean, default: false }
  }],
  description: {
    type: String,
    maxlength: 1000
  },
  floor: {
    type: Number,
    min: 0
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance', 'cleaning', 'out_of_order'],
    default: 'available',
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  dimensions: {
    area: Number, // in square meters
    beds: [{
      type: { type: String, enum: ['single', 'double', 'queen', 'king', 'bunk'] },
      count: { type: Number, min: 1 }
    }]
  },
  rules: {
    smokingAllowed: { type: Boolean, default: false },
    petsAllowed: { type: Boolean, default: false },
    maxGuests: Number,
    quietHours: {
      start: String, // 24h format e.g., "22:00"
      end: String    // 24h format e.g., "08:00"
    }
  },
  maintenance: {
    lastCleaned: Date,
    lastInspection: Date,
    nextMaintenance: Date,
    issues: [{
      description: String,
      reportedAt: { type: Date, default: Date.now },
      severity: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
      resolved: { type: Boolean, default: false },
      resolvedAt: Date
    }]
  }
}, {
  timestamps: true
});

// Compound indexes for performance
roomSchema.index({ type: 1, status: 1, isActive: 1 });
roomSchema.index({ basePrice: 1 });
roomSchema.index({ capacity: 1, currentOccupancy: 1 });

// Virtual for availability
roomSchema.virtual('isAvailable').get(function() {
  return this.status === 'available' && 
         this.isActive && 
         this.currentOccupancy < this.capacity;
});

// Virtual for occupancy rate
roomSchema.virtual('occupancyRate').get(function() {
  return this.capacity > 0 ? (this.currentOccupancy / this.capacity) * 100 : 0;
});

// Instance method to check availability for dates
roomSchema.methods.checkAvailability = async function(checkIn, checkOut, excludeBookingId = null) {
  const Booking = mongoose.model('Booking');
  
  const conflictingBookings = await Booking.find({
    room: this._id,
    status: { $in: ['confirmed', 'checked_in'] },
    $or: [
      {
        checkInDate: { $lt: checkOut },
        checkOutDate: { $gt: checkIn }
      }
    ],
    ...(excludeBookingId && { _id: { $ne: excludeBookingId } })
  });

  // For shared rooms/dorms, check if there's still capacity
  if (this.type === 'shared' || this.type === 'dorm') {
    const occupiedBeds = conflictingBookings.reduce((total, booking) => {
      return total + (booking.guestCount || 1);
    }, 0);
    
    return (occupiedBeds + 1) <= this.capacity;
  }
  
  // For private rooms, no conflicting bookings means available
  return conflictingBookings.length === 0;
};

// Static method to find available rooms
roomSchema.statics.findAvailable = function(checkIn, checkOut, guestCount = 1, roomType = null) {
  const query = {
    status: 'available',
    isActive: true,
    capacity: { $gte: guestCount }
  };
  
  if (roomType) {
    query.type = roomType;
  }
  
  return this.find(query);
};

// Update occupancy method
roomSchema.methods.updateOccupancy = async function() {
  const Booking = mongoose.model('Booking');
  
  const activeBookings = await Booking.find({
    room: this._id,
    status: 'checked_in'
  });
  
  this.currentOccupancy = activeBookings.reduce((total, booking) => {
    return total + (booking.guestCount || 1);
  }, 0);
  
  // Update status based on occupancy
  if (this.currentOccupancy >= this.capacity) {
    this.status = 'occupied';
  } else if (this.currentOccupancy > 0 && (this.type === 'private' || this.type === 'suite')) {
    this.status = 'occupied';
  } else {
    this.status = 'available';
  }
  
  return this.save();
};

module.exports = mongoose.model('Room', roomSchema);