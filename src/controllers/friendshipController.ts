import { Response } from 'express';
import { AuthRequest } from '../types';
import Friendship from '../models/Friendship';
import User from '../models/User';
import asyncHandler from '../utils/asyncHandler';
import mongoose from 'mongoose';

export const sendFriendRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { recipientId } = req.body;

  if (!recipientId) {
    res.status(400).json({
      success: false,
      message: 'Recipient ID is required'
    });
    return;
  }

  if (recipientId === req.user?._id.toString()) {
    res.status(400).json({
      success: false,
      message: 'You cannot send a friend request to yourself'
    });
    return;
  }

  const recipient = await User.findById(recipientId);

  if (!recipient) {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
    return;
  }

  const existingFriendship = await Friendship.findOne({
    $or: [
      { requester: req.user?._id, recipient: recipientId },
      { requester: recipientId, recipient: req.user?._id }
    ]
  });

  if (existingFriendship) {
    if (existingFriendship.status === 'BLOCKED') {
      res.status(403).json({
        success: false,
        message: 'Cannot send friend request'
      });
      return;
    }

    if (existingFriendship.status === 'ACCEPTED') {
      res.status(400).json({
        success: false,
        message: 'You are already friends'
      });
      return;
    }

    if (existingFriendship.status === 'PENDING') {
      res.status(400).json({
        success: false,
        message: 'Friend request already sent'
      });
      return;
    }
  }

  const friendship = await Friendship.create({
    requester: req.user?._id,
    recipient: recipientId,
    status: 'PENDING'
  });

  res.status(201).json({
    success: true,
    message: 'Friend request sent successfully',
    data: { friendship }
  });
});

export const acceptFriendRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { friendshipId } = req.params;

  const friendship = await Friendship.findById(friendshipId);

  if (!friendship) {
    res.status(404).json({
      success: false,
      message: 'Friend request not found'
    });
    return;
  }

  if (friendship.recipient.toString() !== req.user?._id.toString()) {
    res.status(403).json({
      success: false,
      message: 'You are not authorized to accept this request'
    });
    return;
  }

  if (friendship.status !== 'PENDING') {
    res.status(400).json({
      success: false,
      message: 'Friend request is not pending'
    });
    return;
  }

  friendship.status = 'ACCEPTED';
  await friendship.save();

  res.status(200).json({
    success: true,
    message: 'Friend request accepted',
    data: { friendship }
  });
});

export const rejectFriendRequest = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { friendshipId } = req.params;

  const friendship = await Friendship.findById(friendshipId);

  if (!friendship) {
    res.status(404).json({
      success: false,
      message: 'Friend request not found'
    });
    return;
  }

  if (friendship.recipient.toString() !== req.user?._id.toString()) {
    res.status(403).json({
      success: false,
      message: 'You are not authorized to reject this request'
    });
    return;
  }

  if (friendship.status !== 'PENDING') {
    res.status(400).json({
      success: false,
      message: 'Friend request is not pending'
    });
    return;
  }

  await Friendship.findByIdAndDelete(friendshipId);

  res.status(200).json({
    success: true,
    message: 'Friend request rejected'
  });
});

export const blockUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({
      success: false,
      message: 'User ID is required'
    });
    return;
  }

  if (userId === req.user?._id.toString()) {
    res.status(400).json({
      success: false,
      message: 'You cannot block yourself'
    });
    return;
  }

  const userToBlock = await User.findById(userId);

  if (!userToBlock) {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
    return;
  }

  const existingFriendship = await Friendship.findOne({
    $or: [
      { requester: req.user?._id, recipient: userId },
      { requester: userId, recipient: req.user?._id }
    ]
  });

  if (existingFriendship) {
    existingFriendship.requester = req.user?._id as unknown as mongoose.Types.ObjectId;
    existingFriendship.recipient = new mongoose.Types.ObjectId(userId) as unknown as mongoose.Types.ObjectId;
    existingFriendship.status = 'BLOCKED';
    await existingFriendship.save();
  } else {
    await Friendship.create({
      requester: req.user?._id,
      recipient: userId,
      status: 'BLOCKED'
    });
  }

  res.status(200).json({
    success: true,
    message: 'User blocked successfully'
  });
});

export const unblockUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  const friendship = await Friendship.findOne({
    requester: req.user?._id,
    recipient: userId,
    status: 'BLOCKED'
  });

  if (!friendship) {
    res.status(404).json({
      success: false,
      message: 'User is not blocked'
    });
    return;
  }

  await Friendship.findByIdAndDelete(friendship._id);

  res.status(200).json({
    success: true,
    message: 'User unblocked successfully'
  });
});

export const unfriend = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { userId } = req.params;

  const friendship = await Friendship.findOne({
    $or: [
      { requester: req.user?._id, recipient: userId, status: 'ACCEPTED' },
      { requester: userId, recipient: req.user?._id, status: 'ACCEPTED' }
    ]
  });

  if (!friendship) {
    res.status(404).json({
      success: false,
      message: 'Friendship not found'
    });
    return;
  }

  await Friendship.findByIdAndDelete(friendship._id);

  res.status(200).json({
    success: true,
    message: 'Friend removed successfully'
  });
});

export const getFriends = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const friendships = await Friendship.find({
    $or: [
      { requester: req.user?._id, status: 'ACCEPTED' },
      { recipient: req.user?._id, status: 'ACCEPTED' }
    ]
  })
    .populate('requester', 'firstName lastName displayName profileImage')
    .populate('recipient', 'firstName lastName displayName profileImage')
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit))
    .sort({ createdAt: -1 });

  const friends = friendships.map((friendship) => {
    const friend =
      friendship.requester._id.toString() === req.user?._id.toString()
        ? friendship.recipient
        : friendship.requester;
    return friend;
  });

  const total = await Friendship.countDocuments({
    $or: [
      { requester: req.user?._id, status: 'ACCEPTED' },
      { recipient: req.user?._id, status: 'ACCEPTED' }
    ]
  });

  res.status(200).json({
    success: true,
    data: {
      friends,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

export const getPendingRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const friendships = await Friendship.find({
    recipient: req.user?._id,
    status: 'PENDING'
  })
    .populate('requester', 'firstName lastName displayName profileImage')
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit))
    .sort({ createdAt: -1 });

  const total = await Friendship.countDocuments({
    recipient: req.user?._id,
    status: 'PENDING'
  });

  res.status(200).json({
    success: true,
    data: {
      requests: friendships,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

export const getSentRequests = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const friendships = await Friendship.find({
    requester: req.user?._id,
    status: 'PENDING'
  })
    .populate('recipient', 'firstName lastName displayName profileImage')
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit))
    .sort({ createdAt: -1 });

  const total = await Friendship.countDocuments({
    requester: req.user?._id,
    status: 'PENDING'
  });

  res.status(200).json({
    success: true,
    data: {
      requests: friendships,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

export const getBlockedUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { page = 1, limit = 20 } = req.query;

  const friendships = await Friendship.find({
    requester: req.user?._id,
    status: 'BLOCKED'
  })
    .populate('recipient', 'firstName lastName displayName profileImage')
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit))
    .sort({ createdAt: -1 });

  const total = await Friendship.countDocuments({
    requester: req.user?._id,
    status: 'BLOCKED'
  });

  res.status(200).json({
    success: true,
    data: {
      blockedUsers: friendships.map((f) => f.recipient),
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});
