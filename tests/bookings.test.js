const request = require('supertest');
const app = require('../api/index');
const { User, Room, Booking } = require('../api/models');
const jwtUtils = require('../api/utils/jwt');

describe('Booking Endpoints', () => {
  let user, room, adminUser, adminToken, userToken;

  beforeEach(async () => {
    // Create test user
    user = new User({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      password: 'Password123!',
      role: 'guest'
    });
    await user.save();

    // Create admin user
    adminUser = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: 'Password123!',
      role: 'admin'
    });
    await adminUser.save();

    // Create test room
    room = new Room({
      roomNumber: '101',
      type: 'private',
      capacity: 2,
      basePrice: 50,
      amenities: ['wifi', 'ac', 'bathroom']
    });
    await room.save();

    // Generate tokens
    const userTokenPair = jwtUtils.generateTokenPair(user);
    userToken = userTokenPair.accessToken;

    const adminTokenPair = jwtUtils.generateTokenPair(adminUser);
    adminToken = adminTokenPair.accessToken;
  });

  describe('POST /api/bookings', () => {
    test('should create booking successfully', async () => {
      const bookingData = {
        roomId: room._id,
        checkInDate: '2024-12-01',
        checkOutDate: '2024-12-03',
        guestCount: 2,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+1234567890'
          }
        },
        source: 'direct'
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking.bookingReference).toBeTruthy();
      expect(response.body.data.booking.status).toBe('pending');
      expect(response.body.data.booking.guestCount).toBe(2);
    });

    test('should fail with invalid room ID', async () => {
      const bookingData = {
        roomId: 'invalid-id',
        checkInDate: '2024-12-01',
        checkOutDate: '2024-12-03',
        guestCount: 1,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        }
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should fail with invalid dates', async () => {
      const bookingData = {
        roomId: room._id,
        checkInDate: '2024-12-03',
        checkOutDate: '2024-12-01', // Before check-in
        guestCount: 1,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        }
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('should fail when guest count exceeds room capacity', async () => {
      const bookingData = {
        roomId: room._id,
        checkInDate: '2024-12-01',
        checkOutDate: '2024-12-03',
        guestCount: 5, // Room capacity is 2
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        }
      };

      const response = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send(bookingData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('capacity');
    });

    test('should fail without authentication', async () => {
      const bookingData = {
        roomId: room._id,
        checkInDate: '2024-12-01',
        checkOutDate: '2024-12-03',
        guestCount: 1,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        }
      };

      const response = await request(app)
        .post('/api/bookings')
        .send(bookingData)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/bookings', () => {
    let userBooking, otherUserBooking;

    beforeEach(async () => {
      // Create booking for main user
      userBooking = new Booking({
        user: user._id,
        room: room._id,
        checkInDate: new Date('2024-12-01'),
        checkOutDate: new Date('2024-12-03'),
        guestCount: 1,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        },
        pricing: { totalAmount: 100 }
      });
      await userBooking.save();

      // Create another user and booking
      const otherUser = new User({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        password: 'Password123!',
        role: 'guest'
      });
      await otherUser.save();

      otherUserBooking = new Booking({
        user: otherUser._id,
        room: room._id,
        checkInDate: new Date('2024-12-05'),
        checkOutDate: new Date('2024-12-07'),
        guestCount: 1,
        guestDetails: {
          primaryGuest: {
            firstName: 'Jane',
            lastName: 'Smith',
            email: 'jane.smith@example.com'
          }
        },
        pricing: { totalAmount: 100 }
      });
      await otherUserBooking.save();
    });

    test('should get user bookings for guest user', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(1);
      expect(response.body.data.bookings[0]._id).toBe(userBooking._id.toString());
    });

    test('should get all bookings for admin user', async () => {
      const response = await request(app)
        .get('/api/bookings')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(2);
    });

    test('should filter bookings by status', async () => {
      const response = await request(app)
        .get('/api/bookings?status=pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(2);
      response.body.data.bookings.forEach(booking => {
        expect(booking.status).toBe('pending');
      });
    });

    test('should paginate results', async () => {
      const response = await request(app)
        .get('/api/bookings?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.bookings).toHaveLength(1);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.total).toBe(2);
    });
  });

  describe('GET /api/bookings/:id', () => {
    let booking;

    beforeEach(async () => {
      booking = new Booking({
        user: user._id,
        room: room._id,
        checkInDate: new Date('2024-12-01'),
        checkOutDate: new Date('2024-12-03'),
        guestCount: 1,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        },
        pricing: { totalAmount: 100 }
      });
      await booking.save();
    });

    test('should get booking by ID for owner', async () => {
      const response = await request(app)
        .get(`/api/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking._id).toBe(booking._id.toString());
    });

    test('should get booking by ID for admin', async () => {
      const response = await request(app)
        .get(`/api/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking._id).toBe(booking._id.toString());
    });

    test('should fail to get booking for different user', async () => {
      const otherUser = new User({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@example.com',
        password: 'Password123!',
        role: 'guest'
      });
      await otherUser.save();

      const otherUserTokenPair = jwtUtils.generateTokenPair(otherUser);
      const otherUserToken = otherUserTokenPair.accessToken;

      const response = await request(app)
        .get(`/api/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${otherUserToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    test('should fail with invalid booking ID', async () => {
      const response = await request(app)
        .get('/api/bookings/invalid-id')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/bookings/:id', () => {
    let booking;

    beforeEach(async () => {
      booking = new Booking({
        user: user._id,
        room: room._id,
        checkInDate: new Date('2024-12-01'),
        checkOutDate: new Date('2024-12-03'),
        guestCount: 1,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        },
        pricing: { totalAmount: 100 },
        status: 'confirmed'
      });
      await booking.save();
    });

    test('should update booking successfully', async () => {
      const updateData = {
        guestCount: 2,
        checkOutDate: '2024-12-04'
      };

      const response = await request(app)
        .put(`/api/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.booking.guestCount).toBe(2);
    });

    test('should fail to update cancelled booking', async () => {
      booking.status = 'cancelled';
      await booking.save();

      const updateData = {
        guestCount: 2
      };

      const response = await request(app)
        .put(`/api/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/bookings/:id', () => {
    let booking;

    beforeEach(async () => {
      booking = new Booking({
        user: user._id,
        room: room._id,
        checkInDate: new Date('2024-12-01'),
        checkOutDate: new Date('2024-12-03'),
        guestCount: 1,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        },
        pricing: { totalAmount: 100 },
        status: 'confirmed'
      });
      await booking.save();
    });

    test('should cancel booking successfully', async () => {
      const response = await request(app)
        .delete(`/api/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Change of plans' })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Check booking was updated
      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking.status).toBe('cancelled');
      expect(updatedBooking.cancellation.reason).toBe('Change of plans');
    });

    test('should fail to cancel already cancelled booking', async () => {
      booking.status = 'cancelled';
      await booking.save();

      const response = await request(app)
        .delete(`/api/bookings/${booking._id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/bookings/:id/checkin', () => {
    let booking, staffToken;

    beforeEach(async () => {
      // Create staff user
      const staffUser = new User({
        firstName: 'Staff',
        lastName: 'Member',
        email: 'staff@example.com',
        password: 'Password123!',
        role: 'staff'
      });
      await staffUser.save();

      const staffTokenPair = jwtUtils.generateTokenPair(staffUser);
      staffToken = staffTokenPair.accessToken;

      booking = new Booking({
        user: user._id,
        room: room._id,
        checkInDate: new Date(),
        checkOutDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        guestCount: 1,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        },
        pricing: { totalAmount: 100 },
        status: 'confirmed'
      });
      await booking.save();
    });

    test('should check-in guest successfully', async () => {
      const response = await request(app)
        .post(`/api/bookings/${booking._id}/checkin`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Check booking was updated
      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking.status).toBe('checked_in');
      expect(updatedBooking.actualCheckIn).toBeTruthy();
    });

    test('should fail check-in for guest user', async () => {
      const response = await request(app)
        .post(`/api/bookings/${booking._id}/checkin`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Only staff');
    });

    test('should fail check-in for pending booking', async () => {
      booking.status = 'pending';
      await booking.save();

      const response = await request(app)
        .post(`/api/bookings/${booking._id}/checkin`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/bookings/:id/checkout', () => {
    let booking, staffToken;

    beforeEach(async () => {
      // Create staff user
      const staffUser = new User({
        firstName: 'Staff',
        lastName: 'Member',
        email: 'staff@example.com',
        password: 'Password123!',
        role: 'staff'
      });
      await staffUser.save();

      const staffTokenPair = jwtUtils.generateTokenPair(staffUser);
      staffToken = staffTokenPair.accessToken;

      booking = new Booking({
        user: user._id,
        room: room._id,
        checkInDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        checkOutDate: new Date(),
        guestCount: 1,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        },
        pricing: { totalAmount: 100 },
        status: 'checked_in',
        actualCheckIn: new Date(Date.now() - 24 * 60 * 60 * 1000)
      });
      await booking.save();
    });

    test('should check-out guest successfully', async () => {
      const response = await request(app)
        .post(`/api/bookings/${booking._id}/checkout`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ depositReturned: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Check booking was updated
      const updatedBooking = await Booking.findById(booking._id);
      expect(updatedBooking.status).toBe('checked_out');
      expect(updatedBooking.actualCheckOut).toBeTruthy();
    });

    test('should fail check-out for guest user', async () => {
      const response = await request(app)
        .post(`/api/bookings/${booking._id}/checkout`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Only staff');
    });

    test('should fail check-out for confirmed booking', async () => {
      booking.status = 'confirmed';
      await booking.save();

      const response = await request(app)
        .post(`/api/bookings/${booking._id}/checkout`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });
});