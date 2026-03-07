import { Response } from 'express';
import Challenge, { GameType, GameName, Platform } from '../models/Challenge';
import User from '../models/User';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import Notification from '../models/Notification';
import Friendship from '../models/Friendship';
import { AuthRequest } from '../types';
import asyncHandler from '../utils/asyncHandler';

// Get available games configuration
export const getAvailableGames = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const games = [
    {
      gameType: 'FOOTBALL' as GameType,
      gameName: 'DREAM_LEAGUE_SOCCER' as GameName,
      displayName: 'Dream League Soccer',
      platforms: ['MOBILE' as Platform],
      defaultGamePeriod: 10
    },
    {
      gameType: 'FOOTBALL' as GameType,
      gameName: 'EFOOTBALL_MOBILE' as GameName,
      displayName: 'eFootball Mobile',
      platforms: ['MOBILE' as Platform],
      defaultGamePeriod: 10
    }
  ];

  res.json({
    success: true,
    data: { games }
  });
});

// Get user's challenge history
export const getChallengeHistory = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { status, limit = 20, page = 1 } = req.query;

  const query: any = {
    $or: [{ creator: userId }, { acceptor: userId }]
  };

  if (status) {
    query.status = status;
  }

  const skip = (Number(page) - 1) * Number(limit);

  const challenges = await Challenge.find(query)
    .populate('creator', 'displayName profileImage isVerified')
    .populate('acceptor', 'displayName profileImage isVerified')
    .populate('winner', 'displayName profileImage')
    .populate('witness', 'displayName profileImage')
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
    .populate('creator', 'displayName profileImage email isVerified')
    .populate('acceptor', 'displayName profileImage email isVerified')
    .populate('winner', 'displayName profileImage')
    .populate('loser', 'displayName profileImage')
    .populate('witness', 'displayName profileImage isVerified');

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Public challenges can be viewed by anyone
  // Direct and Friends challenges only by participants
  if (challenge.challengeType !== 'PUBLIC') {
    const isParticipant = 
      challenge.creator._id.toString() === userId?.toString() ||
      challenge.acceptor?._id.toString() === userId?.toString();
    
    if (!isParticipant) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to view this challenge'
      });
      return;
    }
  }

  res.json({
    success: true,
    data: { challenge }
  });
});

// Create a new challenge
export const createChallenge = asyncHandler(async (req: AuthRequest, res: Response) => {
  const {
    gameType,
    gameName,
    platform,
    challengeType,
    stakeAmount,
    currency = 'NGN',
    acceptanceDueDate,
    matchStartTime,
    includeExtraTime = false,
    includePenalty = false,
    directOpponentId, // For DIRECT challenges
    creatorStreamingLink
  } = req.body;

  const userId = req.user?._id;
  const username = req.user?.displayName;

  // Validate required fields
  if (!gameType || !gameName || !platform || !challengeType || !stakeAmount || !acceptanceDueDate || !matchStartTime) {
    res.status(400).json({
      success: false,
      message: 'Missing required fields'
    });
    return;
  }

  // Validate dates
  const acceptanceDate = new Date(acceptanceDueDate);
  const startTime = new Date(matchStartTime);
  const now = new Date();

  if (acceptanceDate <= now) {
    res.status(400).json({
      success: false,
      message: 'Acceptance due date must be in the future'
    });
    return;
  }

  if (startTime <= acceptanceDate) {
    res.status(400).json({
      success: false,
      message: 'Match start time must be after acceptance due date'
    });
    return;
  }

  // Validate stake amount
  const minStake = Number(process.env.MIN_STAKE_AMOUNT) || 100;
  const maxStake = Number(process.env.MAX_STAKE_AMOUNT) || 1000000;

  if (stakeAmount < minStake || stakeAmount > maxStake) {
    res.status(400).json({
      success: false,
      message: `Stake amount must be between ₦${minStake.toLocaleString()} and ₦${maxStake.toLocaleString()}`
    });
    return;
  }

  // For DIRECT challenges, validate opponent
  let directOpponent = null;
  if (challengeType === 'DIRECT') {
    if (!directOpponentId) {
      res.status(400).json({
        success: false,
        message: 'Opponent ID required for direct challenges'
      });
      return;
    }

    directOpponent = await User.findById(directOpponentId);
    if (!directOpponent) {
      res.status(404).json({
        success: false,
        message: 'Opponent not found'
      });
      return;
    }

    // Check if they are friends
    const friendship = await Friendship.findOne({
      $or: [
        { requester: userId, recipient: directOpponentId, status: 'ACCEPTED' },
        { requester: directOpponentId, recipient: userId, status: 'ACCEPTED' }
      ]
    });

    if (!friendship) {
      res.status(400).json({
        success: false,
        message: 'You can only send direct challenges to friends'
      });
      return;
    }
  }

  // Check if user has sufficient balance
  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.getBalance(currency) < stakeAmount) {
    res.status(400).json({
      success: false,
      message: 'Insufficient balance'
    });
    return;
  }

  // Determine game period based on game type
  const gamePeriod = (gameType === 'FOOTBALL' || gameType === 'SOCCER') ? 10 : 15;

  // Calculate financial values
  const platformFee = 0.05; // 5%
  const witnessFee = 0.02; // 2%
  const totalPot = stakeAmount * 2; // Both players stake
  const winnerPayout = totalPot * (1 - platformFee - witnessFee); // 93% of pot

  // Create challenge
  const challengeData: any = {
    creator: userId,
    creatorUsername: username,
    gameType,
    gameName,
    platform,
    challengeType,
    stakeAmount,
    currency,
    platformFee,
    witnessFee,
    totalPot,
    winnerPayout,
    acceptanceDueDate: acceptanceDate,
    matchStartTime: startTime,
    gamePeriod,
    includeExtraTime,
    includePenalty,
    status: challengeType === 'DIRECT' ? 'PENDING_ACCEPTANCE' : 'OPEN'
  };

  // For DIRECT challenges, set acceptor immediately
  if (challengeType === 'DIRECT' && directOpponent) {
    challengeData.acceptor = directOpponentId;
    challengeData.acceptorUsername = directOpponent.displayName;
  }

  // Add streaming link if provided
  if (creatorStreamingLink) {
    challengeData.creatorStreamingLink = creatorStreamingLink;
  }

  const challenge = await Challenge.create(challengeData);

  // Deduct stake from creator's wallet
  await wallet.updateBalance(currency, -stakeAmount);

  // Create transaction record
  await Transaction.create({
    userId,
    walletId: wallet._id,
    type: 'STAKE_DEBIT',
    amount: stakeAmount,
    currency,
    status: 'COMPLETED',
    description: `Stake for ${gameName} challenge`,
    metadata: { challengeId: challenge._id }
  });

  // Create notification for direct opponent
  if (challengeType === 'DIRECT' && directOpponentId) {
    await Notification.create({
      userId: directOpponentId,
      type: 'CHALLENGE',
      title: 'New Challenge!',
      message: `${username} challenged you to ${gameName} for ₦${stakeAmount.toLocaleString()}`,
      data: { challengeId: challenge._id }
    });
  }

  const populatedChallenge = await Challenge.findById(challenge._id)
    .populate('creator', 'displayName profileImage isVerified')
    .populate('acceptor', 'displayName profileImage isVerified');

  res.status(201).json({
    success: true,
    message: 'Challenge created successfully',
    data: { challenge: populatedChallenge }
  });
});

// Get public challenges
export const getPublicChallenges = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 20, page = 1 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const query = {
    challengeType: 'PUBLIC',
    status: 'OPEN',
    acceptanceDueDate: { $gt: new Date() }
  };

  const challenges = await Challenge.find(query)
    .populate('creator', 'displayName profileImage isVerified')
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

// Get friends challenges
export const getFriendsChallenges = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { limit = 20, page = 1 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Get user's friends
  const friendships = await Friendship.find({
    $or: [
      { requester: userId, status: 'ACCEPTED' },
      { recipient: userId, status: 'ACCEPTED' }
    ]
  });

  const friendIds = friendships.map(f => 
    f.requester.toString() === userId?.toString() ? f.recipient : f.requester
  );

  const query = {
    challengeType: 'FRIENDS',
    status: 'OPEN',
    creator: { $in: friendIds },
    acceptanceDueDate: { $gt: new Date() }
  };

  const challenges = await Challenge.find(query)
    .populate('creator', 'displayName profileImage isVerified')
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

// Accept a challenge
export const acceptChallenge = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { acceptorStreamingLink } = req.body;
  const userId = req.user?._id;
  const username = req.user?.displayName;

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Validate challenge can be accepted
  if (challenge.status !== 'OPEN' && challenge.status !== 'PENDING_ACCEPTANCE') {
    res.status(400).json({
      success: false,
      message: 'Challenge is not available for acceptance'
    });
    return;
  }

  // Check acceptance deadline
  if (new Date() > challenge.acceptanceDueDate) {
    res.status(400).json({
      success: false,
      message: 'Acceptance deadline has passed'
    });
    return;
  }

  // For DIRECT challenges, only the designated acceptor can accept
  if (challenge.challengeType === 'DIRECT') {
    if (challenge.acceptor?.toString() !== userId?.toString()) {
      res.status(403).json({
        success: false,
        message: 'This challenge is for a specific user'
      });
      return;
    }
  } else {
    // For FRIENDS and PUBLIC, set the acceptor
    if (challenge.challengeType === 'FRIENDS') {
      // Verify they are friends
      const friendship = await Friendship.findOne({
        $or: [
          { requester: userId, recipient: challenge.creator, status: 'ACCEPTED' },
          { requester: challenge.creator, recipient: userId, status: 'ACCEPTED' }
        ]
      });

      if (!friendship) {
        res.status(403).json({
          success: false,
          message: 'You must be friends with the creator to accept this challenge'
        });
        return;
      }
    }

    challenge.acceptor = userId || null;
    challenge.acceptorUsername = username || '';
  }

  // Cannot accept your own challenge
  if (challenge.creator.toString() === userId?.toString()) {
    res.status(400).json({
      success: false,
      message: 'You cannot accept your own challenge'
    });
    return;
  }

  // Check if acceptor has sufficient balance
  const wallet = await Wallet.findOne({ userId });
  if (!wallet || wallet.getBalance(challenge.currency as any) < challenge.stakeAmount) {
    res.status(400).json({
      success: false,
      message: 'Insufficient balance'
    });
    return;
  }

  // Deduct stake from acceptor's wallet
  await wallet.updateBalance(challenge.currency as any, -challenge.stakeAmount);

  // Create transaction record
  await Transaction.create({
    userId,
    walletId: wallet._id,
    type: 'STAKE_DEBIT',
    amount: challenge.stakeAmount,
    currency: challenge.currency,
    status: 'COMPLETED',
    description: `Stake for accepting ${challenge.gameName} challenge`,
    metadata: { challengeId: challenge._id }
  });

  // Update challenge
  challenge.status = 'ACCEPTED';
  if (acceptorStreamingLink) {
    challenge.acceptorStreamingLink = acceptorStreamingLink;
  }
  await challenge.save();

  // Notify creator
  await Notification.create({
    userId: challenge.creator,
    type: 'CHALLENGE_ACCEPTED',
    title: 'Challenge Accepted!',
    message: `${username} accepted your ${challenge.gameName} challenge`,
    data: { challengeId: challenge._id }
  });

  const populatedChallenge = await Challenge.findById(challenge._id)
    .populate('creator', 'displayName profileImage isVerified')
    .populate('acceptor', 'displayName profileImage isVerified');

  res.json({
    success: true,
    message: 'Challenge accepted successfully',
    data: { challenge: populatedChallenge }
  });
});

// Reject a challenge
export const rejectChallenge = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user?._id;

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Only DIRECT challenges can be rejected, and only by the designated acceptor
  if (challenge.challengeType !== 'DIRECT') {
    res.status(400).json({
      success: false,
      message: 'Only direct challenges can be rejected'
    });
    return;
  }

  if (challenge.acceptor?.toString() !== userId?.toString()) {
    res.status(403).json({
      success: false,
      message: 'Only the designated opponent can reject this challenge'
    });
    return;
  }

  if (challenge.status !== 'PENDING_ACCEPTANCE') {
    res.status(400).json({
      success: false,
      message: 'Challenge cannot be rejected in current status'
    });
    return;
  }

  // Update challenge
  challenge.status = 'REJECTED';
  challenge.rejectedBy = userId || null;
  challenge.rejectionReason = reason || 'No reason provided';
  await challenge.save();

  // Refund creator's stake
  const creatorWallet = await Wallet.findOne({ userId: challenge.creator });
  if (creatorWallet) {
    await creatorWallet.updateBalance(challenge.currency as any, challenge.stakeAmount);

    await Transaction.create({
      userId: challenge.creator,
      walletId: creatorWallet._id,
      type: 'STAKE_REFUND',
      amount: challenge.stakeAmount,
      currency: challenge.currency,
      status: 'COMPLETED',
      description: 'Challenge rejected - stake refunded',
      metadata: { challengeId: challenge._id }
    });
  }

  // Notify creator
  await Notification.create({
    userId: challenge.creator,
    type: 'CHALLENGE',
    title: 'Challenge Rejected',
    message: `${req.user?.displayName} rejected your challenge. ${reason || ''}`,
    data: { challengeId: challenge._id }
  });

  res.json({
    success: true,
    message: 'Challenge rejected successfully',
    data: { challenge }
  });
});

// Cancel a challenge
export const cancelChallenge = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user?._id;

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Only creator can cancel before acceptance
  if (challenge.creator.toString() !== userId?.toString()) {
    res.status(403).json({
      success: false,
      message: 'Only the creator can cancel this challenge'
    });
    return;
  }

  // Can only cancel if OPEN or PENDING_ACCEPTANCE
  if (challenge.status !== 'OPEN' && challenge.status !== 'PENDING_ACCEPTANCE') {
    res.status(400).json({
      success: false,
      message: 'Challenge cannot be cancelled in current status'
    });
    return;
  }

  // Refund stake to creator
  const wallet = await Wallet.findOne({ userId: challenge.creator });
  if (wallet) {
    await wallet.updateBalance(challenge.currency as any, challenge.stakeAmount);

    await Transaction.create({
      userId: challenge.creator,
      walletId: wallet._id,
      type: 'STAKE_REFUND',
      amount: challenge.stakeAmount,
      currency: challenge.currency,
      status: 'COMPLETED',
      description: 'Challenge cancelled - stake refunded',
      metadata: { challengeId: challenge._id }
    });
  }

  challenge.status = 'CANCELLED';
  challenge.cancelledBy = userId;
  challenge.cancellationReason = reason || 'Cancelled by creator';
  await challenge.save();

  // Notify acceptor if it was a direct challenge
  if (challenge.challengeType === 'DIRECT' && challenge.acceptor) {
    await Notification.create({
      userId: challenge.acceptor,
      type: 'CHALLENGE',
      title: 'Challenge Cancelled',
      message: `${req.user?.displayName} cancelled the challenge. ${reason || ''}`,
      data: { challengeId: challenge._id }
    });
  }

  res.json({
    success: true,
    message: 'Challenge cancelled successfully',
    data: { challenge }
  });
});

// Update streaming link
export const updateStreamingLink = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { platform, url } = req.body;
  const userId = req.user?._id;

  if (!platform || !url) {
    res.status(400).json({
      success: false,
      message: 'Platform and URL are required'
    });
    return;
  }

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Check if user is participant
  const isCreator = challenge.creator.toString() === userId?.toString();
  const isAcceptor = challenge.acceptor?.toString() === userId?.toString();

  if (!isCreator && !isAcceptor) {
    res.status(403).json({
      success: false,
      message: 'You are not a participant in this challenge'
    });
    return;
  }

  // Update appropriate streaming link
  if (isCreator) {
    challenge.creatorStreamingLink = { platform, url };
  } else {
    challenge.acceptorStreamingLink = { platform, url };
  }

  await challenge.save();

  res.json({
    success: true,
    message: 'Streaming link updated successfully',
    data: { challenge }
  });
});

// Submit result (Witness)
export const submitResult = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { winnerId, creatorScore, acceptorScore } = req.body;
  const userId = req.user?._id;

  if (!winnerId || creatorScore === undefined || acceptorScore === undefined) {
    res.status(400).json({
      success: false,
      message: 'Winner ID and scores are required'
    });
    return;
  }

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  if (challenge.status !== 'ACCEPTED') {
    res.status(400).json({
      success: false,
      message: 'Challenge must be in ACCEPTED status to submit results'
    });
    return;
  }

  // Verify winner is one of the participants
  if (winnerId !== challenge.creator.toString() && winnerId !== challenge.acceptor?.toString()) {
    res.status(400).json({
      success: false,
      message: 'Winner must be one of the participants'
    });
    return;
  }

  // Set witness (first person to submit result becomes witness)
  if (!challenge.witness) {
    challenge.witness = userId || null;
    challenge.witnessUsername = req.user?.displayName || '';
    challenge.witnessVerifiedAt = new Date();
  }

  // Update challenge with results
  challenge.status = 'COMPLETED';
  challenge.winner = winnerId;
  challenge.winnerUsername = winnerId === challenge.creator.toString() 
    ? challenge.creatorUsername 
    : challenge.acceptorUsername || '';
  
  const loserId = winnerId === challenge.creator.toString() 
    ? challenge.acceptor 
    : challenge.creator;
  challenge.loser = loserId;
  challenge.loserUsername = loserId?.toString() === challenge.creator.toString()
    ? challenge.creatorUsername
    : challenge.acceptorUsername || '';
  
  challenge.finalScore = {
    creator: creatorScore,
    acceptor: acceptorScore
  };
  challenge.completedAt = new Date();

  await challenge.save();

  // Notify both participants
  await Notification.create({
    userId: challenge.creator,
    type: 'CHALLENGE_COMPLETED',
    title: 'Challenge Completed',
    message: `Your challenge has been completed. ${challenge.winnerUsername} won!`,
    data: { challengeId: challenge._id }
  });

  if (challenge.acceptor) {
    await Notification.create({
      userId: challenge.acceptor,
      type: 'CHALLENGE_COMPLETED',
      title: 'Challenge Completed',
      message: `Your challenge has been completed. ${challenge.winnerUsername} won!`,
      data: { challengeId: challenge._id }
    });
  }

  res.json({
    success: true,
    message: 'Result submitted successfully. Challenge will be settled shortly.',
    data: { challenge }
  });
});

// Settle challenge (Admin/System)
export const settleChallenge = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  if (challenge.status !== 'COMPLETED') {
    res.status(400).json({
      success: false,
      message: 'Challenge must be completed before settlement'
    });
    return;
  }

  if (!challenge.winner || !challenge.witness) {
    res.status(400).json({
      success: false,
      message: 'Challenge must have a winner and witness'
    });
    return;
  }

  // Calculate payouts
  const witnessFeeAmount = challenge.totalPot * challenge.witnessFee;
  const winnerPayout = challenge.winnerPayout;

  // Pay winner
  const winnerWallet = await Wallet.findOne({ userId: challenge.winner });
  if (winnerWallet) {
    await winnerWallet.updateBalance(challenge.currency as any, winnerPayout);

    await Transaction.create({
      userId: challenge.winner,
      walletId: winnerWallet._id,
      type: 'CHALLENGE_PAYOUT',
      amount: winnerPayout,
      currency: challenge.currency,
      status: 'COMPLETED',
      description: `Won ${challenge.gameName} challenge`,
      metadata: { challengeId: challenge._id }
    });
  }

  // Pay witness
  const witnessWallet = await Wallet.findOne({ userId: challenge.witness });
  if (witnessWallet) {
    await witnessWallet.updateBalance(challenge.currency as any, witnessFeeAmount);

    await Transaction.create({
      userId: challenge.witness,
      walletId: witnessWallet._id,
      type: 'WITNESS_FEE',
      amount: witnessFeeAmount,
      currency: challenge.currency,
      status: 'COMPLETED',
      description: `Witness fee for ${challenge.gameName} challenge`,
      metadata: { challengeId: challenge._id }
    });
  }

  // Platform fee is already deducted (not added to any wallet)

  challenge.status = 'SETTLED';
  challenge.settledAt = new Date();
  await challenge.save();

  // Notify winner
  await Notification.create({
    userId: challenge.winner,
    type: 'PAYMENT',
    title: 'Challenge Settled!',
    message: `You won ₦${winnerPayout.toLocaleString()} from your ${challenge.gameName} challenge!`,
    data: { challengeId: challenge._id }
  });

  // Notify witness
  await Notification.create({
    userId: challenge.witness,
    type: 'PAYMENT',
    title: 'Witness Fee Received',
    message: `You received ₦${witnessFeeAmount.toLocaleString()} for witnessing a challenge`,
    data: { challengeId: challenge._id }
  });

  res.json({
    success: true,
    message: 'Challenge settled successfully',
    data: { challenge }
  });
});

// Get challenge statistics
export const getChallengeStats = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;

  const stats = await Challenge.aggregate([
    {
      $match: {
        $or: [{ creator: userId }, { acceptor: userId }],
        status: 'SETTLED'
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
        totalStaked: { $sum: '$stakeAmount' },
        totalEarnings: {
          $sum: {
            $cond: [
              { $eq: ['$winner', userId] },
              '$winnerPayout',
              0
            ]
          }
        }
      }
    }
  ]);

  const result = stats[0] || {
    totalChallenges: 0,
    wins: 0,
    losses: 0,
    totalStaked: 0,
    totalEarnings: 0
  };

  result.winRate = result.totalChallenges > 0 
    ? Math.round((result.wins / result.totalChallenges) * 100) 
    : 0;

  res.json({
    success: true,
    data: result
  });
});
