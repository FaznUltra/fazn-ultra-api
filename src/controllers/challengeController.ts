import { Response } from 'express';
import Challenge from '../models/Challenge';
import User from '../models/User';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import Notification from '../models/Notification';
import { AuthRequest } from '../types';
import asyncHandler from '../utils/asyncHandler';

// Get user's challenge history
export const getChallengeHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { status, limit = 20, page = 1 } = req.query;

  const query: any = {
    $or: [{ challenger: userId }, { opponent: userId }]
  };

  if (status) {
    query.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const challenges = await Challenge.find(query)
    .populate('challenger', 'displayName profileImage')
    .populate('opponent', 'displayName profileImage')
    .populate('winner', 'displayName')
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(skip);

  const total = await Challenge.countDocuments(query);

  res.json({
    success: true,
    data: {
      challenges,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// Get single challenge details
export const getChallengeById = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const challenge = await Challenge.findById(id)
    .populate('challenger', 'displayName profileImage email')
    .populate('opponent', 'displayName profileImage email')
    .populate('winner', 'displayName profileImage')
    .populate('loser', 'displayName profileImage');

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Check if user is part of this challenge
  if (
    challenge.challenger._id.toString() !== userId?.toString() &&
    challenge.opponent._id.toString() !== userId?.toString()
  ) {
    res.status(403).json({
      success: false,
      message: 'You are not authorized to view this challenge'
    });
    return;
  }

  res.json({
    success: true,
    data: { challenge }
  });
});

// Create a new challenge
export const createChallenge = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { opponentId, game, stakeAmount } = req.body;
  const userId = req.user?._id;

  // Validate stake amount
  const minStake = Number(process.env.MIN_STAKE_AMOUNT) || 100;
  const maxStake = Number(process.env.MAX_STAKE_AMOUNT) || 1000000;

  if (stakeAmount < minStake || stakeAmount > maxStake) {
    res.status(400).json({
      success: false,
      message: `Stake amount must be between ₦${minStake} and ₦${maxStake}`
    });
    return;
  }

  // Check if opponent exists
  const opponent = await User.findById(opponentId);
  if (!opponent) {
    res.status(404).json({
      success: false,
      message: 'Opponent not found'
    });
    return;
  }

  // Check if user has sufficient balance
  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.getBalance('NGN') < stakeAmount) {
    res.status(400).json({
      success: false,
      message: 'Insufficient balance'
    });
    return;
  }

  // Create challenge
  const challenge = await Challenge.create({
    challenger: userId,
    opponent: opponentId,
    game,
    stakeAmount
  });

  // Deduct stake from challenger's wallet
  await Wallet.findOneAndUpdate(
    { userId },
    { $inc: { 'currencies.NGN': -stakeAmount } }
  );

  // Create transaction record
  await Transaction.create({
    userId,
    walletId: wallet._id,
    type: 'STAKE_DEBIT',
    amount: stakeAmount,
    currency: 'NGN',
    status: 'completed',
    description: `Stake for challenge against ${opponent.displayName}`,
    metadata: { challengeId: challenge._id }
  });

  // Create notification for opponent
  await Notification.create({
    userId: opponentId,
    type: 'challenge',
    title: 'New Challenge!',
    message: `${req.user?.displayName} challenged you to ${game} for ₦${stakeAmount.toLocaleString()}`,
    data: { challengeId: challenge._id }
  });

  const populatedChallenge = await Challenge.findById(challenge._id)
    .populate('challenger', 'displayName profileImage')
    .populate('opponent', 'displayName profileImage');

  res.status(201).json({
    success: true,
    message: 'Challenge created successfully',
    data: { challenge: populatedChallenge }
  });
});

// Accept a challenge
export const acceptChallenge = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Check if user is the opponent
  if (challenge.opponent.toString() !== userId?.toString()) {
    res.status(403).json({
      success: false,
      message: 'Only the opponent can accept this challenge'
    });
    return;
  }

  if (challenge.status !== 'pending') {
    res.status(400).json({
      success: false,
      message: 'Challenge is not in pending status'
    });
    return;
  }

  // Check if opponent has sufficient balance
  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.getBalance('NGN') < challenge.stakeAmount) {
    res.status(400).json({
      success: false,
      message: 'Insufficient balance'
    });
    return;
  }

  // Deduct stake from opponent's wallet
  await Wallet.findOneAndUpdate(
    { userId },
    { $inc: { 'currencies.NGN': -challenge.stakeAmount } }
  );

  // Create transaction record
  await Transaction.create({
    userId,
    walletId: wallet._id,
    type: 'STAKE_DEBIT',
    amount: challenge.stakeAmount,
    currency: 'NGN',
    status: 'completed',
    description: `Stake for accepting challenge from ${req.user?.displayName}`,
    metadata: { challengeId: challenge._id }
  });

  // Update challenge status
  challenge.status = 'in_progress';
  await challenge.save();

  // Notify challenger
  await Notification.create({
    userId: challenge.challenger,
    type: 'challenge_accepted',
    title: 'Challenge Accepted!',
    message: `${req.user?.displayName} accepted your challenge`,
    data: { challengeId: challenge._id }
  });

  res.json({
    success: true,
    message: 'Challenge accepted successfully',
    data: { challenge }
  });
});

// Cancel a challenge
export const cancelChallenge = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?._id;

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Only challenger can cancel and only if pending
  if (challenge.challenger.toString() !== userId?.toString()) {
    res.status(403).json({
      success: false,
      message: 'Only the challenger can cancel this challenge'
    });
    return;
  }

  if (challenge.status !== 'pending') {
    res.status(400).json({
      success: false,
      message: 'Only pending challenges can be cancelled'
    });
    return;
  }

  // Refund stake to challenger
  const wallet = await Wallet.findOne({ userId: challenge.challenger });
  if (wallet) {
    await Wallet.findOneAndUpdate(
      { userId: challenge.challenger },
      { $inc: { 'currencies.NGN': challenge.stakeAmount } }
    );

    await Transaction.create({
      userId: challenge.challenger,
      walletId: wallet._id,
      type: 'STAKE_REFUND',
      amount: challenge.stakeAmount,
      currency: 'NGN',
      status: 'completed',
      description: 'Challenge cancelled - stake refunded',
      metadata: { challengeId: challenge._id }
    });
  }

  challenge.status = 'cancelled';
  await challenge.save();

  res.json({
    success: true,
    message: 'Challenge cancelled successfully',
    data: { challenge }
  });
});

// Get challenge statistics
export const getChallengeStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;

  const stats = await Challenge.aggregate([
    {
      $match: {
        $or: [{ challenger: userId }, { opponent: userId }],
        status: 'completed'
      }
    },
    {
      $group: {
        _id: null,
        totalChallenges: { $sum: 1 },
        wins: {
          $sum: {
            $cond: [{ $eq: ['$winner', userId] }, 1, 0]
          }
        },
        losses: {
          $sum: {
            $cond: [{ $eq: ['$loser', userId] }, 1, 0]
          }
        },
        totalStaked: { $sum: '$stakeAmount' }
      }
    }
  ]);

  const result = stats[0] || {
    totalChallenges: 0,
    wins: 0,
    losses: 0,
    totalStaked: 0
  };

  res.json({
    success: true,
    data: result
  });
});
