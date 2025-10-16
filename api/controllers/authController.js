const { User } = require('../models');
const jwtUtils = require('../utils/jwt');
const { API_MESSAGES, TIME_CONSTANTS } = require('../config/constants');

class AuthController {
  /**
   * Register new user
   */
  async register(req, res) {
    try {
      const { firstName, lastName, email, password, phone, role = 'guest' } = req.body;

      // Check if user already exists
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'User with this email already exists'
        });
      }

      // Only admin can create staff/admin users
      if (role !== 'guest' && (!req.user || req.user.role !== 'admin')) {
        return res.status(403).json({
          success: false,
          message: API_MESSAGES.FORBIDDEN,
          error: 'Only admin can create staff or admin accounts'
        });
      }

      // Create new user
      const userData = {
        firstName,
        lastName,
        email,
        password,
        phone,
        role
      };

      const user = new User(userData);
      await user.save();

      // Generate token pair
      const tokenPair = jwtUtils.generateTokenPair(user);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            createdAt: user.createdAt
          },
          tokens: tokenPair
        }
      });

    } catch (error) {
      console.error('Register error:', error);
      
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
   * Login user
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      // Find user with password field
      const user = await User.findOne({ email: email.toLowerCase() })
        .select('+password');

      if (!user) {
        return res.status(401).json({
          success: false,
          message: API_MESSAGES.UNAUTHORIZED,
          error: 'Invalid email or password'
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: API_MESSAGES.UNAUTHORIZED,
          error: 'Account is inactive. Please contact support.'
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: API_MESSAGES.UNAUTHORIZED,
          error: 'Invalid email or password'
        });
      }

      // Generate token pair
      const tokenPair = jwtUtils.generateTokenPair(user);

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            preferences: user.preferences
          },
          tokens: tokenPair
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(req, res) {
    try {
      // User is already validated by middleware
      const user = req.user;

      // Generate new token pair
      const tokenPair = jwtUtils.generateTokenPair(user);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          tokens: tokenPair
        }
      });

    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Get current user profile
   */
  async getProfile(req, res) {
    try {
      const user = req.user;

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            lastLogin: user.lastLogin,
            preferences: user.preferences,
            profile: user.profile,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt
          }
        }
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(req, res) {
    try {
      const user = req.user;
      const updates = req.body;

      // Fields that can be updated by user
      const allowedUpdates = [
        'firstName', 'lastName', 'phone', 'preferences', 'profile'
      ];

      // Admin can update additional fields
      if (user.role === 'admin') {
        allowedUpdates.push('role', 'isActive');
      }

      // Filter updates
      const filteredUpdates = {};
      Object.keys(updates).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updates[key];
        }
      });

      // Check if email is being changed (requires special handling)
      if (updates.email && updates.email !== user.email) {
        const existingUser = await User.findByEmail(updates.email);
        if (existingUser && existingUser._id.toString() !== user._id.toString()) {
          return res.status(400).json({
            success: false,
            message: API_MESSAGES.BAD_REQUEST,
            error: 'Email already in use'
          });
        }
        filteredUpdates.email = updates.email.toLowerCase();
      }

      // Update user
      Object.assign(user, filteredUpdates);
      await user.save();

      res.json({
        success: true,
        message: API_MESSAGES.UPDATED,
        data: {
          user: {
            id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            role: user.role,
            isActive: user.isActive,
            preferences: user.preferences,
            profile: user.profile,
            updatedAt: user.updatedAt
          }
        }
      });

    } catch (error) {
      console.error('Update profile error:', error);
      
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
   * Change password
   */
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id).select('+password');

      // Verify current password
      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Current password is incorrect'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password changed successfully'
      });

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Forgot password - Send reset email
   */
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;

      const user = await User.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return res.json({
          success: true,
          message: 'If a user with that email exists, a password reset link has been sent'
        });
      }

      // Generate password reset token
      const resetToken = jwtUtils.generatePasswordResetToken(user._id, user.email);

      // TODO: Send reset email
      console.log(`Password reset token for ${email}: ${resetToken}`);

      res.json({
        success: true,
        message: 'If a user with that email exists, a password reset link has been sent',
        // Remove this in production
        ...(process.env.NODE_ENV === 'development' && { resetToken })
      });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Reset password with token
   */
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;

      // Verify reset token
      let decoded;
      try {
        decoded = jwtUtils.verifyPasswordResetToken(token);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Invalid or expired reset token'
        });
      }

      // Find user
      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: API_MESSAGES.BAD_REQUEST,
          error: 'Invalid reset token'
        });
      }

      // Update password
      user.password = newPassword;
      await user.save();

      res.json({
        success: true,
        message: 'Password reset successful'
      });

    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Logout user (client-side token removal)
   */
  async logout(req, res) {
    try {
      // In a stateless JWT system, logout is primarily handled client-side
      // Here we could add token to a blacklist if needed
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }

  /**
   * Get all users (Admin only)
   */
  async getAllUsers(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        role,
        isActive,
        search,
        sort = '-createdAt'
      } = req.query;

      // Build filter
      const filter = {};
      if (role) filter.role = role;
      if (isActive !== undefined) filter.isActive = isActive === 'true';
      
      // Search by name or email
      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }

      // Pagination
      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Execute query
      const users = await User.find(filter)
        .select('-__v')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      // Get total count
      const total = await User.countDocuments(filter);

      res.json({
        success: true,
        message: API_MESSAGES.SUCCESS,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
          }
        }
      });

    } catch (error) {
      console.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: API_MESSAGES.SERVER_ERROR,
        error: error.message
      });
    }
  }
}

module.exports = new AuthController();