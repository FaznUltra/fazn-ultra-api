import { Response } from 'express';
import { AuthRequest } from '../types';
import User from '../models/User';
import asyncHandler from '../utils/asyncHandler';

export const searchUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { query, page = 1, limit = 20 } = req.query;

  if (!query || typeof query !== 'string') {
    res.status(400).json({
      success: false,
      message: 'Search query is required'
    });
    return;
  }

  const searchRegex = new RegExp(query, 'i');

  const users = await User.find({
    _id: { $ne: req.user?._id },
    $or: [
      { displayName: searchRegex },
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex }
    ],
    isActive: true
  })
    .select('firstName lastName displayName profileImage stats')
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));

  const total = await User.countDocuments({
    _id: { $ne: req.user?._id },
    $or: [
      { displayName: searchRegex },
      { firstName: searchRegex },
      { lastName: searchRegex },
      { email: searchRegex }
    ],
    isActive: true
  });

  res.status(200).json({
    success: true,
    data: {
      users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

export const getUserProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  const user = await User.findById(userId).select(
    'firstName lastName displayName email profileImage stats streamingAccounts isVerified createdAt'
  );

  if (!user) {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: { user }
  });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { firstName, lastName, profileImage, streamingAccounts } = req.body;

  const user = await User.findById(req.user?._id);

  if (!user) {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
    return;
  }

  if (firstName) user.firstName = firstName;
  if (lastName) user.lastName = lastName;
  if (profileImage) user.profileImage = profileImage;

  if (streamingAccounts) {
    if (streamingAccounts.youtube) {
      user.streamingAccounts.youtube = {
        ...user.streamingAccounts.youtube,
        ...streamingAccounts.youtube
      };
    }
    if (streamingAccounts.twitch) {
      user.streamingAccounts.twitch = {
        ...user.streamingAccounts.twitch,
        ...streamingAccounts.twitch
      };
    }
  }

  await user.save();

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        displayName: user.displayName,
        email: user.email,
        profileImage: user.profileImage,
        streamingAccounts: user.streamingAccounts,
        stats: user.stats
      }
    }
  });
});
