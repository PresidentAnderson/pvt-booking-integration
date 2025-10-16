const nodemailer = require('nodemailer');
const { EMAIL_TEMPLATES } = require('../config/constants');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initialized = false;
    this.init();
  }

  /**
   * Initialize email transporter
   */
  async init() {
    try {
      const emailConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      };

      // Use different config for development/testing
      if (process.env.NODE_ENV === 'development') {
        // Use Ethereal for testing in development
        const testAccount = await nodemailer.createTestAccount();
        emailConfig.host = 'smtp.ethereal.email';
        emailConfig.port = 587;
        emailConfig.secure = false;
        emailConfig.auth = {
          user: testAccount.user,
          pass: testAccount.pass
        };
      }

      this.transporter = nodemailer.createTransporter(emailConfig);
      
      // Verify connection
      await this.transporter.verify();
      this.initialized = true;
      console.log('Email service initialized successfully');

    } catch (error) {
      console.error('Email service initialization failed:', error.message);
      this.initialized = false;
    }
  }

  /**
   * Send email
   */
  async sendEmail({ to, subject, html, text, attachments = [] }) {
    if (!this.initialized) {
      console.warn('Email service not initialized, skipping email send');
      return { success: false, error: 'Email service not initialized' };
    }

    try {
      const mailOptions = {
        from: `${process.env.EMAIL_FROM_NAME || 'PVT Hostel'} <${process.env.EMAIL_FROM || 'noreply@pvthostel.com'}>`,
        to,
        subject,
        html,
        text: text || this.stripHtml(html),
        attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      // Log preview URL in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Email sent:', info.messageId);
        console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
      }

      return { 
        success: true, 
        messageId: info.messageId,
        previewUrl: process.env.NODE_ENV === 'development' ? nodemailer.getTestMessageUrl(info) : null
      };

    } catch (error) {
      console.error('Email send error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send booking confirmation email
   */
  async sendBookingConfirmation(booking, user) {
    const subject = `Booking Confirmation - ${booking.bookingReference}`;
    const html = this.generateBookingConfirmationHtml(booking, user);

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Send booking cancellation email
   */
  async sendBookingCancellation(booking, user, refundAmount = 0) {
    const subject = `Booking Cancelled - ${booking.bookingReference}`;
    const html = this.generateBookingCancellationHtml(booking, user, refundAmount);

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Send check-in reminder email
   */
  async sendCheckInReminder(booking, user) {
    const subject = `Check-in Reminder - ${booking.bookingReference}`;
    const html = this.generateCheckInReminderHtml(booking, user);

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Send payment confirmation email
   */
  async sendPaymentConfirmation(payment, booking, user) {
    const subject = `Payment Confirmation - ${booking.bookingReference}`;
    const html = this.generatePaymentConfirmationHtml(payment, booking, user);

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(user, resetToken) {
    const subject = 'Password Reset Request';
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const html = this.generatePasswordResetHtml(user, resetUrl);

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Send welcome email for new users
   */
  async sendWelcomeEmail(user) {
    const subject = 'Welcome to PVT Hostel!';
    const html = this.generateWelcomeHtml(user);

    return this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }

  /**
   * Generate booking confirmation HTML
   */
  generateBookingConfirmationHtml(booking, user) {
    const checkInDate = new Date(booking.checkInDate).toLocaleDateString();
    const checkOutDate = new Date(booking.checkOutDate).toLocaleDateString();
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .total { font-weight: bold; font-size: 1.2em; color: #2563eb; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏨 Booking Confirmed!</h1>
                <p>Thank you for choosing PVT Hostel</p>
            </div>
            
            <div class="content">
                <h2>Hello ${user.firstName},</h2>
                <p>Your booking has been confirmed! We're excited to host you.</p>
                
                <div class="booking-details">
                    <h3>Booking Details</h3>
                    <div class="detail-row">
                        <span>Booking Reference:</span>
                        <strong>${booking.bookingReference}</strong>
                    </div>
                    <div class="detail-row">
                        <span>Room:</span>
                        <span>${booking.room?.roomNumber || 'N/A'} (${booking.room?.type || 'N/A'})</span>
                    </div>
                    <div class="detail-row">
                        <span>Guest Name:</span>
                        <span>${booking.guestDetails?.primaryGuest?.firstName} ${booking.guestDetails?.primaryGuest?.lastName}</span>
                    </div>
                    <div class="detail-row">
                        <span>Check-in Date:</span>
                        <span>${checkInDate}</span>
                    </div>
                    <div class="detail-row">
                        <span>Check-out Date:</span>
                        <span>${checkOutDate}</span>
                    </div>
                    <div class="detail-row">
                        <span>Number of Guests:</span>
                        <span>${booking.guestCount}</span>
                    </div>
                    <div class="detail-row">
                        <span>Number of Nights:</span>
                        <span>${booking.nights || Math.ceil((booking.checkOutDate - booking.checkInDate) / (1000 * 60 * 60 * 24))}</span>
                    </div>
                    <div class="detail-row total">
                        <span>Total Amount:</span>
                        <span>$${booking.pricing?.totalAmount?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div class="detail-row">
                        <span>Payment Status:</span>
                        <span>${booking.payment?.status || 'Pending'}</span>
                    </div>
                    ${booking.payment?.remainingAmount > 0 ? `
                    <div class="detail-row">
                        <span>Amount Due:</span>
                        <span>$${booking.payment.remainingAmount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                </div>
                
                <h3>Important Information</h3>
                <ul>
                    <li><strong>Check-in Time:</strong> 3:00 PM - 11:00 PM</li>
                    <li><strong>Check-out Time:</strong> 11:00 AM</li>
                    <li><strong>Cancellation:</strong> Free cancellation up to 24 hours before check-in</li>
                    <li><strong>ID Required:</strong> Please bring a valid government-issued photo ID</li>
                </ul>
                
                ${booking.specialRequests?.length > 0 ? `
                <h3>Special Requests</h3>
                <ul>
                    ${booking.specialRequests.map(req => `<li>${req.description}</li>`).join('')}
                </ul>
                ` : ''}
                
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/bookings/${booking._id}" class="button">
                        View Booking Details
                    </a>
                </div>
                
                <p>If you have any questions, please don't hesitate to contact us.</p>
                <p>We look forward to welcoming you!</p>
            </div>
            
            <div class="footer">
                <p>PVT Hostel<br>
                Email: ${process.env.EMAIL_FROM || 'info@pvthostel.com'}<br>
                Phone: +1 (555) 123-4567</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate booking cancellation HTML
   */
  generateBookingCancellationHtml(booking, user, refundAmount) {
    const checkInDate = new Date(booking.checkInDate).toLocaleDateString();
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Booking Cancelled</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .booking-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Booking Cancelled</h1>
            </div>
            
            <div class="content">
                <h2>Hello ${user.firstName},</h2>
                <p>Your booking has been cancelled as requested.</p>
                
                <div class="booking-details">
                    <h3>Cancelled Booking Details</h3>
                    <div class="detail-row">
                        <span>Booking Reference:</span>
                        <strong>${booking.bookingReference}</strong>
                    </div>
                    <div class="detail-row">
                        <span>Check-in Date:</span>
                        <span>${checkInDate}</span>
                    </div>
                    <div class="detail-row">
                        <span>Total Amount:</span>
                        <span>$${booking.pricing?.totalAmount?.toFixed(2) || '0.00'}</span>
                    </div>
                    ${refundAmount > 0 ? `
                    <div class="detail-row">
                        <span>Refund Amount:</span>
                        <span>$${refundAmount.toFixed(2)}</span>
                    </div>
                    <div class="detail-row">
                        <span>Processing Time:</span>
                        <span>3-5 business days</span>
                    </div>
                    ` : ''}
                </div>
                
                ${refundAmount > 0 ? `
                <p>Your refund of $${refundAmount.toFixed(2)} will be processed within 3-5 business days to your original payment method.</p>
                ` : ''}
                
                <p>We're sorry to see you cancel your booking. We hope to host you in the future!</p>
                
                <p>If you have any questions about the cancellation or refund, please contact us.</p>
            </div>
            
            <div class="footer">
                <p>PVT Hostel<br>
                Email: ${process.env.EMAIL_FROM || 'info@pvthostel.com'}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate check-in reminder HTML
   */
  generateCheckInReminderHtml(booking, user) {
    const checkInDate = new Date(booking.checkInDate).toLocaleDateString();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = new Date(booking.checkInDate).toDateString() === tomorrow.toDateString();
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Check-in Reminder</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .highlight { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏨 Check-in Reminder</h1>
                <p>${isTomorrow ? 'Your stay begins tomorrow!' : 'Your stay is coming up soon!'}</p>
            </div>
            
            <div class="content">
                <h2>Hello ${user.firstName},</h2>
                <p>This is a friendly reminder about your upcoming stay with us.</p>
                
                <div class="highlight">
                    <h3>Your Check-in Details</h3>
                    <p><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
                    <p><strong>Check-in Date:</strong> ${checkInDate}</p>
                    <p><strong>Check-in Time:</strong> 3:00 PM - 11:00 PM</p>
                    <p><strong>Room:</strong> ${booking.room?.roomNumber || 'TBD'}</p>
                </div>
                
                <h3>What to Bring</h3>
                <ul>
                    <li>Valid government-issued photo ID</li>
                    <li>Confirmation email (this email or booking reference)</li>
                    <li>Payment method for any outstanding balance</li>
                </ul>
                
                <h3>Check-in Process</h3>
                <ul>
                    <li>Arrive during check-in hours (3:00 PM - 11:00 PM)</li>
                    <li>Present your ID and booking reference</li>
                    <li>Complete a brief registration form</li>
                    <li>Receive your room key and orientation</li>
                </ul>
                
                <p>If you're arriving outside check-in hours, please contact us in advance to arrange late check-in.</p>
                
                <p>We can't wait to welcome you!</p>
            </div>
            
            <div class="footer">
                <p>PVT Hostel<br>
                Email: ${process.env.EMAIL_FROM || 'info@pvthostel.com'}<br>
                Phone: +1 (555) 123-4567</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate payment confirmation HTML
   */
  generatePaymentConfirmationHtml(payment, booking, user) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Payment Confirmation</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #059669; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .payment-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
            .success { color: #059669; font-weight: bold; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✅ Payment Confirmed!</h1>
                <p>Your payment has been successfully processed</p>
            </div>
            
            <div class="content">
                <h2>Hello ${user.firstName},</h2>
                <p>Thank you for your payment! Here are the details:</p>
                
                <div class="payment-details">
                    <h3>Payment Details</h3>
                    <div class="detail-row">
                        <span>Booking Reference:</span>
                        <strong>${booking.bookingReference}</strong>
                    </div>
                    <div class="detail-row">
                        <span>Payment Amount:</span>
                        <span class="success">$${payment.amount.toFixed(2)}</span>
                    </div>
                    <div class="detail-row">
                        <span>Payment Date:</span>
                        <span>${new Date(payment.processedAt || payment.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="detail-row">
                        <span>Payment Method:</span>
                        <span>${payment.paymentMethod?.details?.brand ? payment.paymentMethod.details.brand.toUpperCase() + ' ****' + payment.paymentMethod.details.last4 : 'Card'}</span>
                    </div>
                    <div class="detail-row">
                        <span>Status:</span>
                        <span class="success">${payment.status === 'succeeded' ? 'Paid' : payment.status}</span>
                    </div>
                    ${booking.payment?.remainingAmount > 0 ? `
                    <div class="detail-row">
                        <span>Remaining Balance:</span>
                        <span>$${booking.payment.remainingAmount.toFixed(2)}</span>
                    </div>
                    ` : ''}
                </div>
                
                ${booking.payment?.status === 'paid' ? `
                <p class="success">🎉 Your booking is now fully paid and confirmed!</p>
                ` : ''}
                
                <p>A receipt for this transaction will be available in your booking details.</p>
                
                <p>If you have any questions about this payment, please contact us.</p>
            </div>
            
            <div class="footer">
                <p>PVT Hostel<br>
                Email: ${process.env.EMAIL_FROM || 'info@pvthostel.com'}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate password reset HTML
   */
  generatePasswordResetHtml(user, resetUrl) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Password Reset</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
            .warning { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔐 Password Reset</h1>
            </div>
            
            <div class="content">
                <h2>Hello ${user.firstName},</h2>
                <p>You recently requested to reset your password. Click the button below to reset it:</p>
                
                <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">Reset Password</a>
                </div>
                
                <div class="warning">
                    <p><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
                </div>
                
                <p>If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.</p>
                
                <p>If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="word-break: break-all;">${resetUrl}</p>
            </div>
            
            <div class="footer">
                <p>PVT Hostel<br>
                Email: ${process.env.EMAIL_FROM || 'info@pvthostel.com'}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate welcome email HTML
   */
  generateWelcomeHtml(user) {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Welcome to PVT Hostel</title>
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; margin: 20px 0; }
            .features { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🏨 Welcome to PVT Hostel!</h1>
                <p>Your account has been created successfully</p>
            </div>
            
            <div class="content">
                <h2>Hello ${user.firstName},</h2>
                <p>Welcome to PVT Hostel! We're excited to have you as part of our community.</p>
                
                <div class="features">
                    <h3>What you can do with your account:</h3>
                    <ul>
                        <li>🛏️ Book rooms online with instant confirmation</li>
                        <li>💳 Secure payment processing with Stripe</li>
                        <li>📱 Manage your bookings from any device</li>
                        <li>🔔 Receive booking confirmations and reminders</li>
                        <li>⭐ Leave reviews and feedback</li>
                    </ul>
                </div>
                
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL}/dashboard" class="button">
                        Go to Dashboard
                    </a>
                </div>
                
                <p>If you have any questions or need help getting started, don't hesitate to reach out to us.</p>
                
                <p>Happy travels!</p>
            </div>
            
            <div class="footer">
                <p>PVT Hostel<br>
                Email: ${process.env.EMAIL_FROM || 'info@pvthostel.com'}<br>
                Phone: +1 (555) 123-4567</p>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Strip HTML tags from text
   */
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  /**
   * Schedule check-in reminders
   */
  async scheduleCheckInReminders() {
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

      // Find bookings with check-in tomorrow
      const { Booking } = require('../models');
      const upcomingBookings = await Booking.find({
        checkInDate: {
          $gte: tomorrow,
          $lt: dayAfterTomorrow
        },
        status: { $in: ['confirmed', 'pending'] }
      }).populate('user', 'firstName lastName email');

      console.log(`Found ${upcomingBookings.length} bookings with check-in tomorrow`);

      for (const booking of upcomingBookings) {
        if (booking.user?.email) {
          await this.sendCheckInReminder(booking, booking.user);
          console.log(`Sent check-in reminder to ${booking.user.email} for booking ${booking.bookingReference}`);
        }
      }

    } catch (error) {
      console.error('Error scheduling check-in reminders:', error);
    }
  }
}

module.exports = new EmailService();