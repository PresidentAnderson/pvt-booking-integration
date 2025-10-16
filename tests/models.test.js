const { User, Room, Booking, Payment } = require('../api/models');

describe('Database Models', () => {
  describe('User Model', () => {
    test('should create a user with valid data', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        role: 'guest'
      };

      const user = new User(userData);
      const savedUser = await user.save();

      expect(savedUser._id).toBeDefined();
      expect(savedUser.firstName).toBe('John');
      expect(savedUser.email).toBe('john.doe@example.com');
      expect(savedUser.password).not.toBe('Password123!'); // Should be hashed
      expect(savedUser.role).toBe('guest');
      expect(savedUser.isActive).toBe(true);
    });

    test('should fail with invalid email', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        password: 'Password123!',
        role: 'guest'
      };

      const user = new User(userData);
      await expect(user.save()).rejects.toThrow();
    });

    test('should compare password correctly', async () => {
      const user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        role: 'guest'
      });

      await user.save();

      const isMatch = await user.comparePassword('Password123!');
      const isNotMatch = await user.comparePassword('WrongPassword');

      expect(isMatch).toBe(true);
      expect(isNotMatch).toBe(false);
    });

    test('should get full name', () => {
      const user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!'
      });

      expect(user.getFullName()).toBe('John Doe');
    });

    test('should find user by email', async () => {
      const user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!'
      });

      await user.save();

      const foundUser = await User.findByEmail('john.doe@example.com');
      const notFound = await User.findByEmail('notfound@example.com');

      expect(foundUser).toBeTruthy();
      expect(foundUser.email).toBe('john.doe@example.com');
      expect(notFound).toBeNull();
    });
  });

  describe('Room Model', () => {
    test('should create a room with valid data', async () => {
      const roomData = {
        roomNumber: '101',
        type: 'private',
        capacity: 2,
        basePrice: 50.00,
        amenities: ['wifi', 'ac', 'bathroom'],
        description: 'A comfortable private room'
      };

      const room = new Room(roomData);
      const savedRoom = await room.save();

      expect(savedRoom._id).toBeDefined();
      expect(savedRoom.roomNumber).toBe('101');
      expect(savedRoom.type).toBe('private');
      expect(savedRoom.capacity).toBe(2);
      expect(savedRoom.basePrice).toBe(50);
      expect(savedRoom.status).toBe('available');
      expect(savedRoom.isActive).toBe(true);
    });

    test('should calculate occupancy rate', () => {
      const room = new Room({
        roomNumber: '101',
        type: 'dorm',
        capacity: 8,
        currentOccupancy: 6,
        basePrice: 25
      });

      expect(room.occupancyRate).toBe(75);
    });

    test('should check availability correctly', async () => {
      const room = new Room({
        roomNumber: '101',
        type: 'private',
        capacity: 2,
        basePrice: 50
      });

      await room.save();

      // No conflicting bookings
      const available1 = await room.checkAvailability(
        new Date('2024-12-01'),
        new Date('2024-12-03')
      );
      expect(available1).toBe(true);
    });

    test('should find available rooms', async () => {
      const room1 = new Room({
        roomNumber: '101',
        type: 'private',
        capacity: 2,
        basePrice: 50,
        status: 'available'
      });

      const room2 = new Room({
        roomNumber: '102',
        type: 'private',
        capacity: 2,
        basePrice: 60,
        status: 'occupied'
      });

      await Promise.all([room1.save(), room2.save()]);

      const availableRooms = await Room.findAvailable(
        new Date('2024-12-01'),
        new Date('2024-12-03'),
        1
      );

      expect(availableRooms).toHaveLength(1);
      expect(availableRooms[0].roomNumber).toBe('101');
    });
  });

  describe('Booking Model', () => {
    let user, room;

    beforeEach(async () => {
      user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!'
      });
      await user.save();

      room = new Room({
        roomNumber: '101',
        type: 'private',
        capacity: 2,
        basePrice: 50
      });
      await room.save();
    });

    test('should create a booking with valid data', async () => {
      const bookingData = {
        user: user._id,
        room: room._id,
        checkInDate: new Date('2024-12-01'),
        checkOutDate: new Date('2024-12-03'),
        guestCount: 2,
        guestDetails: {
          primaryGuest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com'
          }
        },
        pricing: {
          baseAmount: 100,
          taxes: 15,
          totalAmount: 115
        }
      };

      const booking = new Booking(bookingData);
      const savedBooking = await booking.save();

      expect(savedBooking._id).toBeDefined();
      expect(savedBooking.bookingReference).toBeTruthy();
      expect(savedBooking.bookingReference).toMatch(/^PVT/);
      expect(savedBooking.status).toBe('pending');
      expect(savedBooking.guestCount).toBe(2);
    });

    test('should calculate number of nights correctly', () => {
      const booking = new Booking({
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

      expect(booking.nights).toBe(2);
    });

    test('should validate dates correctly', async () => {
      const invalidBooking = new Booking({
        user: user._id,
        room: room._id,
        checkInDate: new Date('2024-12-03'),
        checkOutDate: new Date('2024-12-01'), // Before check-in
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

      await expect(invalidBooking.save()).rejects.toThrow();
    });

    test('should check if booking is active', () => {
      const confirmedBooking = new Booking({
        user: user._id,
        room: room._id,
        status: 'confirmed',
        checkInDate: new Date('2024-12-01'),
        checkOutDate: new Date('2024-12-03'),
        guestCount: 1,
        guestDetails: {
          primaryGuest: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
        },
        pricing: { totalAmount: 100 }
      });

      const cancelledBooking = new Booking({
        user: user._id,
        room: room._id,
        status: 'cancelled',
        checkInDate: new Date('2024-12-01'),
        checkOutDate: new Date('2024-12-03'),
        guestCount: 1,
        guestDetails: {
          primaryGuest: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
        },
        pricing: { totalAmount: 100 }
      });

      expect(confirmedBooking.isActive()).toBe(true);
      expect(cancelledBooking.isActive()).toBe(false);
    });

    test('should calculate cancellation fee correctly', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 48 * 60 * 60 * 1000); // 48 hours from now

      const booking = new Booking({
        user: user._id,
        room: room._id,
        checkInDate: futureDate,
        checkOutDate: new Date(futureDate.getTime() + 24 * 60 * 60 * 1000),
        guestCount: 1,
        guestDetails: {
          primaryGuest: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
        },
        pricing: { totalAmount: 100 }
      });

      const fee = booking.calculateCancellationFee();
      expect(fee).toBe(25); // 25% fee for 2-7 days
    });
  });

  describe('Payment Model', () => {
    let user, booking;

    beforeEach(async () => {
      user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!'
      });
      await user.save();

      const room = new Room({
        roomNumber: '101',
        type: 'private',
        capacity: 2,
        basePrice: 50
      });
      await room.save();

      booking = new Booking({
        user: user._id,
        room: room._id,
        checkInDate: new Date('2024-12-01'),
        checkOutDate: new Date('2024-12-03'),
        guestCount: 1,
        guestDetails: {
          primaryGuest: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' }
        },
        pricing: { totalAmount: 100 }
      });
      await booking.save();
    });

    test('should create a payment with valid data', async () => {
      const paymentData = {
        booking: booking._id,
        user: user._id,
        amount: 100,
        currency: 'USD',
        status: 'succeeded',
        paymentMethod: {
          type: 'card',
          details: {
            last4: '4242',
            brand: 'visa'
          }
        },
        description: 'Payment for booking'
      };

      const payment = new Payment(paymentData);
      const savedPayment = await payment.save();

      expect(savedPayment._id).toBeDefined();
      expect(savedPayment.amount).toBe(100);
      expect(savedPayment.currency).toBe('USD');
      expect(savedPayment.status).toBe('succeeded');
      expect(savedPayment.receiptNumber).toBeTruthy();
    });

    test('should calculate net amount correctly', () => {
      const payment = new Payment({
        booking: booking._id,
        user: user._id,
        amount: 100,
        currency: 'USD',
        fees: {
          platform: 3,
          processing: 2,
          total: 5
        }
      });

      expect(payment.netAmount).toBe(95);
    });

    test('should calculate total refunded amount', () => {
      const payment = new Payment({
        booking: booking._id,
        user: user._id,
        amount: 100,
        currency: 'USD',
        refunds: [
          { amount: 20, status: 'succeeded' },
          { amount: 30, status: 'succeeded' },
          { amount: 10, status: 'failed' }
        ]
      });

      expect(payment.totalRefunded).toBe(50);
    });

    test('should calculate refundable amount correctly', () => {
      const payment = new Payment({
        booking: booking._id,
        user: user._id,
        amount: 100,
        currency: 'USD',
        status: 'succeeded',
        refunds: [
          { amount: 30, status: 'succeeded' }
        ]
      });

      expect(payment.refundableAmount).toBe(70);
    });

    test('should process refund correctly', async () => {
      const payment = new Payment({
        booking: booking._id,
        user: user._id,
        amount: 100,
        currency: 'USD',
        status: 'succeeded'
      });

      await payment.save();

      await payment.processRefund(50, 'Customer request', user._id);

      expect(payment.refunds).toHaveLength(1);
      expect(payment.refunds[0].amount).toBe(50);
      expect(payment.status).toBe('partially_refunded');
    });

    test('should not allow refund of non-successful payment', async () => {
      const payment = new Payment({
        booking: booking._id,
        user: user._id,
        amount: 100,
        currency: 'USD',
        status: 'failed'
      });

      await expect(() => payment.processRefund(50, 'Test', user._id))
        .toThrow('Can only refund successful payments');
    });
  });
});