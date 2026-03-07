import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import User from '../models/User';
import Wallet from '../models/Wallet';
import { generateToken, generateRefreshToken } from '../utils/jwt';
import asyncHandler from '../utils/asyncHandler';
import { AuthRequest } from '../types';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }

  const { firstName, lastName, displayName, email, password } = req.body;

  const existingUser = await User.findOne({
    $or: [{ email }, { displayName }]
  });

  if (existingUser) {
    const field = existingUser.email === email ? 'Email' : 'Display name';
    res.status(400).json({
      success: false,
      message: `${field} already exists`
    });
    return;
  }

  const user = await User.create({
    firstName,
    lastName,
    displayName,
    email,
    password
  });

  await Wallet.create({
    userId: user._id,
    currencies: [{ code: 'NGN', balance: 0, isActive: true }]
  });

  const payload = {
    userId: user._id,
    email: user.email,
    displayName: user.displayName
  };

  const token = generateToken(payload);
  const refreshToken = generateRefreshToken(payload);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        email: user.email,
        profileImage: user.profileImage,
        isVerified: user.isVerified
      },
      token,
      refreshToken
    }
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
    return;
  }

  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
    return;
  }

  const isPasswordValid = await user.comparePassword(password);

  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({
      success: false,
      message: 'Account is deactivated'
    });
    return;
  }

  user.lastLogin = new Date();
  await user.save();

  const payload = {
    userId: user._id,
    email: user.email,
    displayName: user.displayName
  };

  const token = generateToken(payload);
  const refreshToken = generateRefreshToken(payload);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        email: user.email,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        streamingAccounts: user.streamingAccounts,
        stats: user.stats
      },
      token,
      refreshToken
    }
  });
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = req.user;

  if (!user) {
    res.status(401).json({
      success: false,
      message: 'Not authorized'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        email: user.email,
        profileImage: user.profileImage,
        isVerified: user.isVerified,
        streamingAccounts: user.streamingAccounts,
        stats: user.stats,
        lastLogin: user.lastLogin
      }
    }
  });
});
