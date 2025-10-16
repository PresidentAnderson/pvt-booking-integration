const request = require('supertest');
const app = require('../api/index');
const { User } = require('../api/models');
const jwtUtils = require('../api/utils/jwt');

describe('Authentication Endpoints', () => {
  describe('POST /api/auth/register', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        phone: '+1234567890'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('john.doe@example.com');
      expect(response.body.data.user.firstName).toBe('John');
      expect(response.body.data.tokens.accessToken).toBeTruthy();
      expect(response.body.data.tokens.refreshToken).toBeTruthy();
    });

    test('should fail with invalid email', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeTruthy();
    });

    test('should fail with weak password', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: '123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeTruthy();
    });

    test('should fail with duplicate email', async () => {
      const userData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!'
      };

      // Create first user
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });
  });

  describe('POST /api/auth/login', () => {
    let user;

    beforeEach(async () => {
      user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        role: 'guest'
      });
      await user.save();
    });

    test('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'john.doe@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('john.doe@example.com');
      expect(response.body.data.tokens.accessToken).toBeTruthy();
      expect(response.body.data.tokens.refreshToken).toBeTruthy();
    });

    test('should fail with invalid email', async () => {
      const loginData = {
        email: 'wrong@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid email or password');
    });

    test('should fail with invalid password', async () => {
      const loginData = {
        email: 'john.doe@example.com',
        password: 'WrongPassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid email or password');
    });

    test('should fail with inactive user', async () => {
      user.isActive = false;
      await user.save();

      const loginData = {
        email: 'john.doe@example.com',
        password: 'Password123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('inactive');
    });
  });

  describe('GET /api/auth/profile', () => {
    let user, token;

    beforeEach(async () => {
      user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        role: 'guest'
      });
      await user.save();

      const tokenPair = jwtUtils.generateTokenPair(user);
      token = tokenPair.accessToken;
    });

    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('john.doe@example.com');
      expect(response.body.data.user.firstName).toBe('John');
    });

    test('should fail without token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No token provided');
    });

    test('should fail with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/auth/profile', () => {
    let user, token;

    beforeEach(async () => {
      user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        role: 'guest'
      });
      await user.save();

      const tokenPair = jwtUtils.generateTokenPair(user);
      token = tokenPair.accessToken;
    });

    test('should update profile successfully', async () => {
      const updateData = {
        firstName: 'Jane',
        phone: '+1987654321',
        preferences: {
          notifications: { email: false }
        }
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.firstName).toBe('Jane');
      expect(response.body.data.user.phone).toBe('+1987654321');
    });

    test('should fail with invalid phone format', async () => {
      const updateData = {
        phone: 'invalid-phone'
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeTruthy();
    });
  });

  describe('POST /api/auth/change-password', () => {
    let user, token;

    beforeEach(async () => {
      user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        role: 'guest'
      });
      await user.save();

      const tokenPair = jwtUtils.generateTokenPair(user);
      token = tokenPair.accessToken;
    });

    test('should change password successfully', async () => {
      const changeData = {
        currentPassword: 'Password123!',
        newPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(changeData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify password was changed
      const updatedUser = await User.findById(user._id).select('+password');
      const isOldValid = await updatedUser.comparePassword('Password123!');
      const isNewValid = await updatedUser.comparePassword('NewPassword123!');

      expect(isOldValid).toBe(false);
      expect(isNewValid).toBe(true);
    });

    test('should fail with incorrect current password', async () => {
      const changeData = {
        currentPassword: 'WrongPassword',
        newPassword: 'NewPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(changeData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Current password is incorrect');
    });

    test('should fail with weak new password', async () => {
      const changeData = {
        currentPassword: 'Password123!',
        newPassword: '123'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send(changeData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeTruthy();
    });
  });

  describe('POST /api/auth/refresh', () => {
    let user, refreshToken;

    beforeEach(async () => {
      user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        role: 'guest'
      });
      await user.save();

      const tokenPair = jwtUtils.generateTokenPair(user);
      refreshToken = tokenPair.refreshToken;
    });

    test('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tokens.accessToken).toBeTruthy();
      expect(response.body.data.tokens.refreshToken).toBeTruthy();
    });

    test('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    test('should fail without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Refresh token required');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    let user;

    beforeEach(async () => {
      user = new User({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        password: 'Password123!',
        role: 'guest'
      });
      await user.save();
    });

    test('should process forgot password request', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'john.doe@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset link');
    });

    test('should not reveal if email exists', async () => {
      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('password reset link');
    });
  });
});