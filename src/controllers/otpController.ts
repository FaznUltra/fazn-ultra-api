import { Response } from 'express';
import { AuthRequest } from '../types';
import OTP from '../models/OTP';
import User from '../models/User';
import emailService from '../services/emailService';
import { generateOTP } from '../utils/generateOTP';
import asyncHandler from '../utils/asyncHandler';

export const sendVerificationOTP = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user?._id);

  if (!user) {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
    return;
  }

  if (user.isVerified) {
    res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
    return;
  }

  await OTP.deleteMany({
    userId: user._id,
    purpose: 'EMAIL_VERIFICATION',
    isUsed: false
  });

  const otpCode = generateOTP(6);

  await OTP.create({
    userId: user._id,
    email: user.email,
    otp: otpCode,
    purpose: 'EMAIL_VERIFICATION',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });

  try {
    await emailService.sendOTP(user.email, otpCode, user.firstName);

    res.status(200).json({
      success: true,
      message: 'OTP sent to your email',
      data: {
        email: user.email,
        expiresIn: '10 minutes'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
});

export const verifyEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { otp } = req.body;

  if (!otp) {
    res.status(400).json({
      success: false,
      message: 'OTP is required'
    });
    return;
  }

  const user = await User.findById(req.user?._id);

  if (!user) {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
    return;
  }

  if (user.isVerified) {
    res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
    return;
  }

  const otpRecord = await OTP.findOne({
    userId: user._id,
    otp,
    purpose: 'EMAIL_VERIFICATION',
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

  otpRecord.isUsed = true;
  await otpRecord.save();

  user.isVerified = true;
  await user.save();

  res.status(200).json({
    success: true,
    message: 'Email verified successfully',
    data: {
      user: {
        id: user._id,
        email: user.email,
        isVerified: user.isVerified
      }
    }
  });
});

export const resendOTP = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await User.findById(req.user?._id);

  if (!user) {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
    return;
  }

  if (user.isVerified) {
    res.status(400).json({
      success: false,
      message: 'Email is already verified'
    });
    return;
  }

  const recentOTP = await OTP.findOne({
    userId: user._id,
    purpose: 'EMAIL_VERIFICATION',
    createdAt: { $gt: new Date(Date.now() - 60 * 1000) }
  });

  if (recentOTP) {
    res.status(429).json({
      success: false,
      message: 'Please wait 1 minute before requesting a new OTP'
    });
    return;
  }

  await OTP.deleteMany({
    userId: user._id,
    purpose: 'EMAIL_VERIFICATION',
    isUsed: false
  });

  const otpCode = generateOTP(6);

  await OTP.create({
    userId: user._id,
    email: user.email,
    otp: otpCode,
    purpose: 'EMAIL_VERIFICATION',
    expiresAt: new Date(Date.now() + 10 * 60 * 1000)
  });

  try {
    await emailService.sendOTP(user.email, otpCode, user.firstName);

    res.status(200).json({
      success: true,
      message: 'New OTP sent to your email',
      data: {
        email: user.email,
        expiresIn: '10 minutes'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.'
    });
  }
});
