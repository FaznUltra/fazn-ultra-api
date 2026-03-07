import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import User from '../models/User';
import OTP from '../models/OTP';
import emailService from '../services/emailService';
import { generateOTP } from '../utils/generateOTP';
import asyncHandler from '../utils/asyncHandler';

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }

  const { email } = req.body;

  if (!email) {
    res.status(400).json({
      success: false,
      message: 'Email is required'
    });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    // Don't reveal if user exists for security
    res.status(200).json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset code',
      data: {
        email,
        expiresIn: '10 minutes'
      }
    });
    return;
  }

  // Delete any existing unused password reset OTPs
  await OTP.deleteMany({
    userId: user._id,
    purpose: 'PASSWORD_RESET',
    isUsed: false
  });

  // Generate new OTP
  const otpCode = generateOTP(6);

  // Create OTP record
  await OTP.create({
    userId: user._id,
    email: user.email,
    otp: otpCode,
    purpose: 'PASSWORD_RESET',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  });

  // Send email
  try {
    await emailService.sendPasswordResetOTP(user.email, otpCode, user.firstName);

    res.status(200).json({
      success: true,
      message: 'Password reset code sent to your email',
      data: {
        email: user.email,
        expiresIn: '10 minutes'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send password reset code. Please try again.'
    });
  }
});

export const verifyResetOTP = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }

  const { email, otp } = req.body;

  if (!email || !otp) {
    res.status(400).json({
      success: false,
      message: 'Email and OTP are required'
    });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
    return;
  }

  // Find valid OTP
  const otpRecord = await OTP.findOne({
    userId: user._id,
    email: user.email,
    otp,
    purpose: 'PASSWORD_RESET',
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });

  if (!otpRecord) {
    res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP'
    });
    return;
  }

  res.status(200).json({
    success: true,
    message: 'OTP verified successfully',
    data: {
      email: user.email,
      verified: true
    }
  });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }

  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    res.status(400).json({
      success: false,
      message: 'Email, OTP, and new password are required'
    });
    return;
  }

  // Validate password strength
  if (newPassword.length < 8) {
    res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long'
    });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
    return;
  }

  // Find and verify OTP
  const otpRecord = await OTP.findOne({
    userId: user._id,
    email: user.email,
    otp,
    purpose: 'PASSWORD_RESET',
    isUsed: false,
    expiresAt: { $gt: new Date() }
  });

  if (!otpRecord) {
    res.status(400).json({
      success: false,
      message: 'Invalid or expired OTP'
    });
    return;
  }

  // Mark OTP as used
  otpRecord.isUsed = true;
  await otpRecord.save();

  // Set new password (will be hashed by pre-save hook)
  user.password = newPassword;
  await user.save();

  // Delete all other password reset OTPs for this user
  await OTP.deleteMany({
    userId: user._id,
    purpose: 'PASSWORD_RESET'
  });

  res.status(200).json({
    success: true,
    message: 'Password reset successfully',
    data: {
      email: user.email
    }
  });
});
