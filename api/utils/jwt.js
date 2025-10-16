const jwt = require('jsonwebtoken');
const { TIME_CONSTANTS } = require('../config/constants');

class JWTUtils {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
    this.refreshSecret = process.env.REFRESH_TOKEN_SECRET || 'fallback-refresh-secret';
    this.jwtExpire = process.env.JWT_EXPIRE || TIME_CONSTANTS.JWT_EXPIRE;
    this.refreshExpire = process.env.REFRESH_TOKEN_EXPIRE || TIME_CONSTANTS.REFRESH_TOKEN_EXPIRE;
  }

  /**
   * Generate access token
   * @param {Object} payload - Token payload
   * @param {String} expiresIn - Token expiration time
   * @returns {String} JWT token
   */
  generateToken(payload, expiresIn = this.jwtExpire) {
    try {
      return jwt.sign(payload, this.jwtSecret, {
        expiresIn,
        issuer: 'pvt-booking-api',
        audience: 'pvt-booking-client'
      });
    } catch (error) {
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  /**
   * Generate refresh token
   * @param {Object} payload - Token payload
   * @returns {String} Refresh token
   */
  generateRefreshToken(payload) {
    try {
      return jwt.sign(payload, this.refreshSecret, {
        expiresIn: this.refreshExpire,
        issuer: 'pvt-booking-api',
        audience: 'pvt-booking-client'
      });
    } catch (error) {
      throw new Error(`Refresh token generation failed: ${error.message}`);
    }
  }

  /**
   * Verify access token
   * @param {String} token - JWT token to verify
   * @returns {Object} Decoded payload
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret, {
        issuer: 'pvt-booking-api',
        audience: 'pvt-booking-client'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      }
      throw new Error(`Token verification failed: ${error.message}`);
    }
  }

  /**
   * Verify refresh token
   * @param {String} token - Refresh token to verify
   * @returns {Object} Decoded payload
   */
  verifyRefreshToken(token) {
    try {
      return jwt.verify(token, this.refreshSecret, {
        issuer: 'pvt-booking-api',
        audience: 'pvt-booking-client'
      });
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      }
      throw new Error(`Refresh token verification failed: ${error.message}`);
    }
  }

  /**
   * Decode token without verification (useful for expired tokens)
   * @param {String} token - JWT token to decode
   * @returns {Object} Decoded payload
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new Error(`Token decode failed: ${error.message}`);
    }
  }

  /**
   * Generate token pair (access + refresh)
   * @param {Object} user - User object
   * @returns {Object} Token pair
   */
  generateTokenPair(user) {
    const payload = {
      userId: user._id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    };

    const accessToken = this.generateToken(payload);
    const refreshToken = this.generateRefreshToken({
      userId: user._id,
      email: user.email
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpire,
      tokenType: 'Bearer'
    };
  }

  /**
   * Extract token from authorization header
   * @param {String} authHeader - Authorization header value
   * @returns {String|null} Extracted token
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
    
    return parts[1];
  }

  /**
   * Check if token is expired
   * @param {String} token - JWT token
   * @returns {Boolean} True if expired
   */
  isTokenExpired(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.payload) return true;
      
      const currentTime = Date.now() / 1000;
      return decoded.payload.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration time
   * @param {String} token - JWT token
   * @returns {Date|null} Expiration date
   */
  getTokenExpiration(token) {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.payload || !decoded.payload.exp) return null;
      
      return new Date(decoded.payload.exp * 1000);
    } catch (error) {
      return null;
    }
  }

  /**
   * Create password reset token
   * @param {String} userId - User ID
   * @param {String} email - User email
   * @returns {String} Password reset token
   */
  generatePasswordResetToken(userId, email) {
    const payload = {
      userId,
      email,
      type: 'password_reset'
    };

    return this.generateToken(payload, TIME_CONSTANTS.PASSWORD_RESET_EXPIRE);
  }

  /**
   * Verify password reset token
   * @param {String} token - Password reset token
   * @returns {Object} Decoded payload
   */
  verifyPasswordResetToken(token) {
    const decoded = this.verifyToken(token);
    
    if (decoded.type !== 'password_reset') {
      throw new Error('Invalid token type');
    }

    return decoded;
  }
}

module.exports = new JWTUtils();