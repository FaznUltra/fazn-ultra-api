import { Response } from 'express';
import Challenge, { GameType, GameName, Platform } from '../models/Challenge';
import User from '../models/User';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import Notification from '../models/Notification';
import AdminReview from '../models/AdminReview';
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

  // Authorization logic:
  // - PUBLIC: Anyone can view
  // - ACCEPTED challenges: Anyone can view (for witnessing)
  // - DIRECT: Only creator and designated acceptor
  // - FRIENDS: Creator, acceptor, or any friend of creator
  
  // Allow anyone to view ACCEPTED challenges for witnessing
  if (challenge.status === 'ACCEPTED') {
    // No authorization check needed - open for witnessing
  } else if (challenge.challengeType === 'DIRECT') {
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
  } else if (challenge.challengeType === 'FRIENDS') {
    const isParticipant = 
      challenge.creator._id.toString() === userId?.toString() ||
      challenge.acceptor?._id.toString() === userId?.toString();
    
    if (!isParticipant) {
      // Check if user is friends with creator
      const friendship = await Friendship.findOne({
        $or: [
          { requester: userId, recipient: challenge.creator._id, status: 'ACCEPTED' },
          { requester: challenge.creator._id, recipient: userId, status: 'ACCEPTED' }
        ]
      });

      if (!friendship) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to view this challenge'
        });
        return;
      }
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

  // Get balance before deduction
  const balanceBefore = wallet.getBalance(currency);
  
  // Deduct stake from creator's wallet
  await wallet.updateBalance(currency, -stakeAmount);

  // Get balance after deduction
  const balanceAfter = wallet.getBalance(currency);

  // Generate unique transaction reference
  const reference = `STAKE_${challenge._id}_${Date.now()}`;

  // Create transaction record
  await Transaction.create({
    userId,
    walletId: wallet._id,
    type: 'STAKE_DEBIT',
    amount: stakeAmount,
    currency,
    status: 'COMPLETED',
    reference,
    description: `Stake for ${gameName} challenge`,
    balanceBefore,
    balanceAfter,
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

// Get challenges available for witnessing
export const getWitnessingChallenges = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 20, page = 1 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  // Find accepted challenges without a witness
  const query = {
    status: 'ACCEPTED',
    witness: null,
    matchStartTime: { $gt: new Date() } // Only upcoming matches
  };

  const challenges = await Challenge.find(query)
    .populate('creator', 'displayName profileImage isVerified')
    .populate('acceptor', 'displayName profileImage isVerified')
    .sort({ matchStartTime: 1 }) // Soonest matches first
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

// Volunteer as witness for a challenge
export const volunteerAsWitness = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Verify challenge is in ACCEPTED status
  if (challenge.status !== 'ACCEPTED') {
    res.status(400).json({
      success: false,
      message: 'Challenge must be accepted before a witness can volunteer'
    });
    return;
  }

  // Verify challenge doesn't already have a witness
  if (challenge.witness) {
    res.status(400).json({
      success: false,
      message: 'This challenge already has a witness'
    });
    return;
  }

  // Verify user is not a participant
  if (challenge.creator.toString() === userId?.toString() || 
      challenge.acceptor?.toString() === userId?.toString()) {
    res.status(400).json({
      success: false,
      message: 'Participants cannot be witnesses'
    });
    return;
  }

  // Verify match hasn't started yet
  if (new Date(challenge.matchStartTime) <= new Date()) {
    res.status(400).json({
      success: false,
      message: 'Cannot volunteer for a match that has already started'
    });
    return;
  }

  // Assign witness
  challenge.witness = userId || null;
  challenge.witnessUsername = req.user?.displayName || '';
  challenge.witnessVerifiedAt = new Date();

  await challenge.save();

  // Notify both participants
  await Notification.create({
    userId: challenge.creator,
    type: 'CHALLENGE',
    title: 'Witness Assigned',
    message: `${req.user?.displayName} has volunteered to witness your challenge`,
    data: { challengeId: challenge._id }
  });

  if (challenge.acceptor) {
    await Notification.create({
      userId: challenge.acceptor,
      type: 'CHALLENGE',
      title: 'Witness Assigned',
      message: `${req.user?.displayName} has volunteered to witness your challenge`,
      data: { challengeId: challenge._id }
    });
  }

  res.json({
    success: true,
    message: 'Successfully volunteered as witness',
    data: { challenge }
  });
});

// Get challenges user is witnessing
export const getMyWitnessingChallenges = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { limit = 20, page = 1 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  const challenges = await Challenge.find({ witness: userId })
    .populate('creator', 'displayName profileImage isVerified')
    .populate('acceptor', 'displayName profileImage isVerified')
    .sort({ matchStartTime: -1 })
    .limit(Number(limit))
    .skip(skip);

  const total = await Challenge.countDocuments({ witness: userId });

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

// Share or update room code (Creator only)
export const shareRoomCode = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;
  const { roomCode } = req.body;

  if (!roomCode || typeof roomCode !== 'string' || roomCode.trim().length === 0) {
    res.status(400).json({
      success: false,
      message: 'Room code is required'
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

  // Verify user is the creator
  if (challenge.creator.toString() !== userId?.toString()) {
    res.status(403).json({
      success: false,
      message: 'Only the challenge creator can share the room code'
    });
    return;
  }

  // Verify challenge is accepted
  if (challenge.status !== 'ACCEPTED') {
    res.status(400).json({
      success: false,
      message: 'Challenge must be accepted before sharing room code'
    });
    return;
  }

  // Verify witness has joined
  if (!challenge.witness) {
    res.status(400).json({
      success: false,
      message: 'A witness must join before sharing the room code'
    });
    return;
  }

  // Verify match hasn't started yet
  if (challenge.matchStartedAt) {
    res.status(400).json({
      success: false,
      message: 'Cannot update room code after match has started'
    });
    return;
  }

  const isUpdating = !!challenge.roomCode;

  // Update room code and reset join confirmations if updating
  challenge.roomCode = roomCode.trim();
  challenge.roomCodeSharedAt = new Date();
  
  if (isUpdating) {
    challenge.creatorJoinedRoom = false;
    challenge.acceptorJoinedRoom = false;
  }

  await challenge.save();

  // Notify acceptor and witness
  const notificationTitle = isUpdating ? 'Room Code Updated' : 'Room Code Shared';
  const notificationMessage = isUpdating 
    ? `${req.user?.displayName} has updated the room code to: ${roomCode}`
    : `${req.user?.displayName} has shared the room code: ${roomCode}`;

  if (challenge.acceptor) {
    await Notification.create({
      userId: challenge.acceptor,
      type: 'CHALLENGE',
      title: notificationTitle,
      message: notificationMessage,
      data: { challengeId: challenge._id, roomCode }
    });
  }

  if (challenge.witness) {
    await Notification.create({
      userId: challenge.witness,
      type: 'CHALLENGE',
      title: notificationTitle,
      message: notificationMessage,
      data: { challengeId: challenge._id, roomCode }
    });
  }

  res.json({
    success: true,
    message: isUpdating ? 'Room code updated successfully' : 'Room code shared successfully',
    data: { challenge }
  });
});

// Confirm player has joined the room
export const confirmJoinedRoom = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Verify user is a participant
  const isCreator = challenge.creator.toString() === userId?.toString();
  const isAcceptor = challenge.acceptor?.toString() === userId?.toString();

  if (!isCreator && !isAcceptor) {
    res.status(403).json({
      success: false,
      message: 'Only participants can confirm they have joined'
    });
    return;
  }

  // Verify room code has been shared
  if (!challenge.roomCode) {
    res.status(400).json({
      success: false,
      message: 'Room code has not been shared yet'
    });
    return;
  }

  // Verify match hasn't started yet
  if (challenge.matchStartedAt) {
    res.status(400).json({
      success: false,
      message: 'Match has already started'
    });
    return;
  }

  // Update join confirmation
  if (isCreator) {
    challenge.creatorJoinedRoom = true;
  } else {
    challenge.acceptorJoinedRoom = true;
  }

  await challenge.save();

  // Notify witness if both players have joined
  if (challenge.creatorJoinedRoom && challenge.acceptorJoinedRoom && challenge.witness) {
    await Notification.create({
      userId: challenge.witness,
      type: 'CHALLENGE',
      title: 'Players Ready',
      message: 'Both players have joined the room. You can now start the match.',
      data: { challengeId: challenge._id }
    });
  }

  res.json({
    success: true,
    message: 'Successfully confirmed room join',
    data: { challenge }
  });
});

// Start match (Witness only)
export const startMatch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Verify user is the witness
  if (challenge.witness?.toString() !== userId?.toString()) {
    res.status(403).json({
      success: false,
      message: 'Only the witness can start the match'
    });
    return;
  }

  // Verify room code has been shared
  if (!challenge.roomCode) {
    res.status(400).json({
      success: false,
      message: 'Room code has not been shared yet'
    });
    return;
  }

  // Verify both players have confirmed they joined
  if (!challenge.creatorJoinedRoom || !challenge.acceptorJoinedRoom) {
    res.status(400).json({
      success: false,
      message: 'Both players must confirm they have joined the room before starting'
    });
    return;
  }

  // Verify match hasn't already started
  if (challenge.matchStartedAt) {
    res.status(400).json({
      success: false,
      message: 'Match has already been started'
    });
    return;
  }

  // Start the match
  challenge.matchStartedAt = new Date();
  challenge.status = 'LIVE';
  await challenge.save();

  // Notify both participants
  await Notification.create({
    userId: challenge.creator,
    type: 'CHALLENGE',
    title: 'Match Started',
    message: `The witness has started the match. Good luck!`,
    data: { challengeId: challenge._id }
  });

  if (challenge.acceptor) {
    await Notification.create({
      userId: challenge.acceptor,
      type: 'CHALLENGE',
      title: 'Match Started',
      message: `The witness has started the match. Good luck!`,
      data: { challengeId: challenge._id }
    });
  }

  res.json({
    success: true,
    message: 'Match started successfully',
    data: { challenge }
  });
});

// Flag match for suspicious activity
export const flagMatch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length < 10) {
    res.status(400).json({
      success: false,
      message: 'Please provide a detailed reason for flagging (minimum 10 characters)'
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

  // Verify user is a participant or witness
  const isCreator = challenge.creator.toString() === userId?.toString();
  const isAcceptor = challenge.acceptor?.toString() === userId?.toString();
  const isWitness = challenge.witness?.toString() === userId?.toString();

  if (!isCreator && !isAcceptor && !isWitness) {
    res.status(403).json({
      success: false,
      message: 'Only participants or witness can flag this match'
    });
    return;
  }

  // Verify match is in a flaggable state (LIVE or COMPLETED)
  if (challenge.status !== 'LIVE' && challenge.status !== 'COMPLETED') {
    res.status(400).json({
      success: false,
      message: 'Match can only be flagged when it is live or completed'
    });
    return;
  }

  // Check if already flagged
  if (challenge.isFlagged) {
    res.status(400).json({
      success: false,
      message: 'This match has already been flagged'
    });
    return;
  }

  // Determine user role
  let role: 'CREATOR' | 'ACCEPTOR' | 'WITNESS';
  if (isCreator) role = 'CREATOR';
  else if (isAcceptor) role = 'ACCEPTOR';
  else role = 'WITNESS';

  // Flag the match and lock it
  challenge.isFlagged = true;
  challenge.flaggedBy = userId || null;
  challenge.flaggedByRole = role;
  challenge.flagReason = reason.trim();
  challenge.flaggedAt = new Date();
  challenge.reviewStatus = 'PENDING_REVIEW';
  await challenge.save();

  // Calculate priority based on stake amount (higher stakes = higher priority)
  let priority = 3; // default
  if (challenge.stakeAmount >= 50000) priority = 5;
  else if (challenge.stakeAmount >= 20000) priority = 4;
  else if (challenge.stakeAmount >= 5000) priority = 3;
  else if (challenge.stakeAmount >= 1000) priority = 2;
  else priority = 1;

  // Get stream URL from creator or acceptor
  const streamUrl = challenge.creatorStreamingLink?.url || challenge.acceptorStreamingLink?.url || null;

  // Create admin review entry
  await AdminReview.create({
    challengeId: challenge._id,
    type: 'FLAG',
    raisedBy: userId,
    raisedByRole: role,
    reason: reason.trim(),
    evidence: {
      streamUrl,
      screenshots: [],
      additionalNotes: null
    },
    status: 'PENDING',
    priority
  });

  // Notify all participants
  const notificationMessage = `Match has been flagged by ${role.toLowerCase()} for admin review. Challenge is now locked pending investigation.`;

  if (!isCreator && challenge.creator) {
    await Notification.create({
      userId: challenge.creator,
      type: 'CHALLENGE',
      title: 'Match Flagged',
      message: notificationMessage,
      data: { challengeId: challenge._id }
    });
  }

  if (!isAcceptor && challenge.acceptor) {
    await Notification.create({
      userId: challenge.acceptor,
      type: 'CHALLENGE',
      title: 'Match Flagged',
      message: notificationMessage,
      data: { challengeId: challenge._id }
    });
  }

  if (!isWitness && challenge.witness) {
    await Notification.create({
      userId: challenge.witness,
      type: 'CHALLENGE',
      title: 'Match Flagged',
      message: notificationMessage,
      data: { challengeId: challenge._id }
    });
  }

  res.json({
    success: true,
    message: 'Match flagged successfully. Our team will review this case.',
    data: { challenge }
  });
});

// Complete match (witness only)
export const completeMatch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;
  const { creatorScore, acceptorScore } = req.body;

  // Validate scores
  if (typeof creatorScore !== 'number' || typeof acceptorScore !== 'number') {
    res.status(400).json({
      success: false,
      message: 'Both creator and acceptor scores must be provided as numbers'
    });
    return;
  }

  if (creatorScore < 0 || acceptorScore < 0) {
    res.status(400).json({
      success: false,
      message: 'Scores cannot be negative'
    });
    return;
  }

  if (creatorScore > 99 || acceptorScore > 99) {
    res.status(400).json({
      success: false,
      message: 'Scores seem unrealistic. Please verify and try again.'
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

  // Verify user is the witness
  if (challenge.witness?.toString() !== userId?.toString()) {
    res.status(403).json({
      success: false,
      message: 'Only the assigned witness can complete this match'
    });
    return;
  }

  // Verify match is live
  if (challenge.status !== 'LIVE') {
    res.status(400).json({
      success: false,
      message: 'Match must be in LIVE status to be completed'
    });
    return;
  }

  // Verify match has been started
  if (!challenge.matchStartedAt) {
    res.status(400).json({
      success: false,
      message: 'Match has not been started yet'
    });
    return;
  }

  // Check if match is flagged
  if (challenge.isFlagged) {
    res.status(400).json({
      success: false,
      message: 'This match has been flagged and cannot be completed until reviewed'
    });
    return;
  }

  // Determine winner
  let winnerId: typeof challenge.creator | null = null;
  let winnerUsername = '';
  let loserId: typeof challenge.creator | null = null;
  let loserUsername = '';

  if (creatorScore > acceptorScore) {
    winnerId = challenge.creator;
    winnerUsername = challenge.creatorUsername;
    loserId = challenge.acceptor;
    loserUsername = challenge.acceptorUsername || '';
  } else if (acceptorScore > creatorScore) {
    winnerId = challenge.acceptor;
    winnerUsername = challenge.acceptorUsername || '';
    loserId = challenge.creator;
    loserUsername = challenge.creatorUsername;
  }
  // If scores are equal, it's a draw - no winner

  // Update challenge
  challenge.status = 'COMPLETED';
  challenge.completedAt = new Date();
  challenge.finalScore = {
    creator: creatorScore,
    acceptor: acceptorScore
  };
  challenge.winner = winnerId;
  challenge.winnerUsername = winnerUsername;
  challenge.loser = loserId;
  challenge.loserUsername = loserUsername;
  
  // Set dispute deadline to 10 minutes from now
  challenge.disputeDeadline = new Date(Date.now() + 10 * 60 * 1000);
  
  await challenge.save();

  // Notify both players
  const resultMessage = winnerId 
    ? `Match completed! ${winnerUsername} won ${creatorScore}-${acceptorScore}. You have 10 minutes to dispute if needed.`
    : `Match completed! It's a draw ${creatorScore}-${acceptorScore}. You have 10 minutes to dispute if needed.`;

  await Notification.create({
    userId: challenge.creator,
    type: 'CHALLENGE',
    title: 'Match Completed',
    message: resultMessage,
    data: { challengeId: challenge._id }
  });

  if (challenge.acceptor) {
    await Notification.create({
      userId: challenge.acceptor,
      type: 'CHALLENGE',
      title: 'Match Completed',
      message: resultMessage,
      data: { challengeId: challenge._id }
    });
  }

  res.json({
    success: true,
    message: 'Match completed successfully. Players have 10 minutes to dispute.',
    data: { challenge }
  });
});

// Dispute match result (players only)
export const disputeMatch = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason || reason.trim().length < 20) {
    res.status(400).json({
      success: false,
      message: 'Please provide a detailed reason for the dispute (minimum 20 characters)'
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

  // Verify user is creator or acceptor
  const isCreator = challenge.creator.toString() === userId?.toString();
  const isAcceptor = challenge.acceptor?.toString() === userId?.toString();

  if (!isCreator && !isAcceptor) {
    res.status(403).json({
      success: false,
      message: 'Only players can dispute match results'
    });
    return;
  }

  // Verify match is completed
  if (challenge.status !== 'COMPLETED') {
    res.status(400).json({
      success: false,
      message: 'Only completed matches can be disputed'
    });
    return;
  }

  // Verify within dispute window
  if (!challenge.disputeDeadline || new Date() > challenge.disputeDeadline) {
    res.status(400).json({
      success: false,
      message: 'Dispute window has expired. Match will be settled automatically.'
    });
    return;
  }

  // Check if already disputed
  if (challenge.isDisputed) {
    res.status(400).json({
      success: false,
      message: 'This match has already been disputed'
    });
    return;
  }

  // Get disputer user to track dispute count
  const disputer = await User.findById(userId);
  if (!disputer) {
    res.status(404).json({
      success: false,
      message: 'User not found'
    });
    return;
  }

  // Check if user is suspended or banned
  if (disputer.accountStatus === 'SUSPENDED' || disputer.accountStatus === 'BANNED') {
    res.status(403).json({
      success: false,
      message: 'Your account is suspended. You cannot dispute matches.'
    });
    return;
  }

  // Warn user if they have previous inappropriate disputes
  if (disputer.inappropriateDisputeCount === 1) {
    console.log(`[DISPUTE] User ${disputer.displayName} has 1 previous inappropriate dispute - warning issued`);
  } else if (disputer.inappropriateDisputeCount === 2) {
    console.log(`[DISPUTE] User ${disputer.displayName} has 2 previous inappropriate disputes - final warning`);
  }

  // Create dispute and lock challenge
  challenge.isDisputed = true;
  challenge.disputedBy = userId || null;
  challenge.disputeReason = reason.trim();
  challenge.disputedAt = new Date();
  challenge.status = 'DISPUTED';
  challenge.reviewStatus = 'PENDING_REVIEW';
  await challenge.save();

  // Determine user role
  const role: 'CREATOR' | 'ACCEPTOR' = isCreator ? 'CREATOR' : 'ACCEPTOR';

  // Calculate priority based on stake amount
  let priority = 3;
  if (challenge.stakeAmount >= 50000) priority = 5;
  else if (challenge.stakeAmount >= 20000) priority = 4;
  else if (challenge.stakeAmount >= 5000) priority = 3;
  else if (challenge.stakeAmount >= 1000) priority = 2;
  else priority = 1;

  // Get stream URL
  const streamUrl = challenge.creatorStreamingLink?.url || challenge.acceptorStreamingLink?.url || null;

  // Create admin review entry
  await AdminReview.create({
    challengeId: challenge._id,
    type: 'DISPUTE',
    raisedBy: userId,
    raisedByRole: role,
    reason: reason.trim(),
    evidence: {
      streamUrl,
      screenshots: [],
      additionalNotes: null
    },
    status: 'PENDING',
    priority
  });

  // Notify other player and witness
  const disputerName = isCreator ? challenge.creatorUsername : challenge.acceptorUsername;
  const disputeMessage = `${disputerName} has disputed the match result. Challenge is locked pending admin review.`;

  if (!isCreator && challenge.creator) {
    await Notification.create({
      userId: challenge.creator,
      type: 'CHALLENGE',
      title: 'Match Disputed',
      message: disputeMessage,
      data: { challengeId: challenge._id }
    });
  }

  if (!isAcceptor && challenge.acceptor) {
    await Notification.create({
      userId: challenge.acceptor,
      type: 'CHALLENGE',
      title: 'Match Disputed',
      message: disputeMessage,
      data: { challengeId: challenge._id }
    });
  }

  if (challenge.witness) {
    await Notification.create({
      userId: challenge.witness,
      type: 'CHALLENGE',
      title: 'Match Disputed',
      message: `Your witnessed match has been disputed by ${disputerName}. Admin will review.`,
      data: { challengeId: challenge._id }
    });
  }

  res.json({
    success: true,
    message: 'Dispute submitted successfully. Our team will review this case.',
    data: { challenge }
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

  // Require streaming link when accepting
  if (!acceptorStreamingLink || !acceptorStreamingLink.platform || !acceptorStreamingLink.url) {
    res.status(400).json({
      success: false,
      message: 'Streaming link is required to accept a challenge'
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

  // Get balance before deduction
  const balanceBefore = wallet.getBalance(challenge.currency as any);
  
  // Deduct stake from acceptor's wallet
  await wallet.updateBalance(challenge.currency as any, -challenge.stakeAmount);

  // Get balance after deduction
  const balanceAfter = wallet.getBalance(challenge.currency as any);

  // Generate unique transaction reference
  const reference = `STAKE_${challenge._id}_${userId}_${Date.now()}`;

  // Create transaction record
  await Transaction.create({
    userId,
    walletId: wallet._id,
    type: 'STAKE_DEBIT',
    amount: challenge.stakeAmount,
    currency: challenge.currency,
    status: 'COMPLETED',
    reference,
    description: `Stake for accepting ${challenge.gameName} challenge`,
    balanceBefore,
    balanceAfter,
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
    const balanceBefore = creatorWallet.getBalance(challenge.currency as any);
    await creatorWallet.updateBalance(challenge.currency as any, challenge.stakeAmount);
    const balanceAfter = creatorWallet.getBalance(challenge.currency as any);
    const reference = `REFUND_${challenge._id}_${challenge.creator}_${Date.now()}`;

    await Transaction.create({
      userId: challenge.creator,
      walletId: creatorWallet._id,
      type: 'STAKE_REFUND',
      amount: challenge.stakeAmount,
      currency: challenge.currency,
      status: 'COMPLETED',
      reference,
      description: `Refund for rejected ${challenge.gameName} challenge`,
      balanceBefore,
      balanceAfter,
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
    const balanceBefore = wallet.getBalance(challenge.currency as any);
    await wallet.updateBalance(challenge.currency as any, challenge.stakeAmount);
    const balanceAfter = wallet.getBalance(challenge.currency as any);
    const reference = `CANCEL_REFUND_${challenge._id}_${Date.now()}`;

    await Transaction.create({
      userId: challenge.creator,
      walletId: wallet._id,
      type: 'STAKE_REFUND',
      amount: challenge.stakeAmount,
      currency: challenge.currency,
      status: 'COMPLETED',
      reference,
      description: `Refund for cancelled ${challenge.gameName} challenge`,
      balanceBefore,
      balanceAfter,
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

// Settle challenge (Witness only, after dispute window)
export const settleChallenge = asyncHandler(async (req: AuthRequest, res: Response) => {
  const userId = req.user?._id;
  const { id } = req.params;

  const challenge = await Challenge.findById(id);

  if (!challenge) {
    res.status(404).json({
      success: false,
      message: 'Challenge not found'
    });
    return;
  }

  // Verify user is the witness
  if (challenge.witness?.toString() !== userId?.toString()) {
    res.status(403).json({
      success: false,
      message: 'Only the assigned witness can settle this challenge'
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

  // Check if challenge is flagged
  if (challenge.isFlagged) {
    res.status(400).json({
      success: false,
      message: 'Cannot settle a flagged challenge. Admin review required.'
    });
    return;
  }

  // Check if challenge is disputed
  if (challenge.isDisputed) {
    res.status(400).json({
      success: false,
      message: 'Cannot settle a disputed challenge. Admin review required.'
    });
    return;
  }

  // Check if challenge is under review
  if (challenge.reviewStatus === 'PENDING_REVIEW' || challenge.reviewStatus === 'UNDER_REVIEW') {
    res.status(400).json({
      success: false,
      message: 'Cannot settle a challenge under admin review. Please wait for resolution.'
    });
    return;
  }

  // Check if dispute window has passed
  if (challenge.disputeDeadline && new Date() < new Date(challenge.disputeDeadline)) {
    const timeLeft = Math.ceil((new Date(challenge.disputeDeadline).getTime() - Date.now()) / 1000 / 60);
    res.status(400).json({
      success: false,
      message: `Cannot settle yet. Players have ${timeLeft} minute(s) left to dispute.`
    });
    return;
  }

  if (!challenge.witness) {
    res.status(400).json({
      success: false,
      message: 'Challenge must have a witness'
    });
    return;
  }

  // Calculate payouts
  const witnessFeeAmount = challenge.totalPot * challenge.witnessFee;

  if (!challenge.winner) {
    // Draw - refund both players
    console.log(`[Settlement] Challenge ${challenge._id} is a draw - refunding both players`);

    // Refund creator
    const creatorWallet = await Wallet.findOne({ userId: challenge.creator });
    if (creatorWallet) {
      const creatorBalanceBefore = creatorWallet.getBalance(challenge.currency as any);
      await creatorWallet.updateBalance(challenge.currency as any, challenge.stakeAmount);
      const creatorBalanceAfter = creatorWallet.getBalance(challenge.currency as any);

      await Transaction.create({
        userId: challenge.creator,
        walletId: creatorWallet._id,
        type: 'STAKE_REFUND',
        amount: challenge.stakeAmount,
        currency: challenge.currency,
        status: 'COMPLETED',
        reference: `REFUND_${challenge._id}_${Date.now()}`,
        description: `Refund for draw in ${challenge.gameName} challenge`,
        balanceBefore: creatorBalanceBefore,
        balanceAfter: creatorBalanceAfter,
        metadata: { challengeId: challenge._id, reason: 'Draw' }
      });
    }

    // Refund acceptor
    if (challenge.acceptor) {
      const acceptorWallet = await Wallet.findOne({ userId: challenge.acceptor });
      if (acceptorWallet) {
        const acceptorBalanceBefore = acceptorWallet.getBalance(challenge.currency as any);
        await acceptorWallet.updateBalance(challenge.currency as any, challenge.stakeAmount);
        const acceptorBalanceAfter = acceptorWallet.getBalance(challenge.currency as any);

        await Transaction.create({
          userId: challenge.acceptor,
          walletId: acceptorWallet._id,
          type: 'STAKE_REFUND',
          amount: challenge.stakeAmount,
          currency: challenge.currency,
          status: 'COMPLETED',
          reference: `REFUND_${challenge._id}_${Date.now()}`,
          description: `Refund for draw in ${challenge.gameName} challenge`,
          balanceBefore: acceptorBalanceBefore,
          balanceAfter: acceptorBalanceAfter,
          metadata: { challengeId: challenge._id, reason: 'Draw' }
        });
      }
    }

    // Notify both players
    await Notification.create({
      userId: challenge.creator,
      type: 'PAYMENT',
      title: 'Challenge Settled - Draw',
      message: `Your stake of ₦${challenge.stakeAmount.toLocaleString()} has been refunded.`,
      data: { challengeId: challenge._id }
    });

    if (challenge.acceptor) {
      await Notification.create({
        userId: challenge.acceptor,
        type: 'PAYMENT',
        title: 'Challenge Settled - Draw',
        message: `Your stake of ₦${challenge.stakeAmount.toLocaleString()} has been refunded.`,
        data: { challengeId: challenge._id }
      });
    }

  } else {
    // Winner exists - pay winner and witness
    console.log(`[Settlement] Challenge ${challenge._id} - Winner: ${challenge.winnerUsername}`);

    const winnerPayout = challenge.winnerPayout;

    // Pay winner
    const winnerWallet = await Wallet.findOne({ userId: challenge.winner });
    if (winnerWallet) {
      const winnerBalanceBefore = winnerWallet.getBalance(challenge.currency as any);
      await winnerWallet.updateBalance(challenge.currency as any, winnerPayout);
      const winnerBalanceAfter = winnerWallet.getBalance(challenge.currency as any);
      const winnerReference = `WIN_${challenge._id}_${Date.now()}`;

      await Transaction.create({
        userId: challenge.winner,
        walletId: winnerWallet._id,
        type: 'WINNING_CREDIT',
        amount: winnerPayout,
        currency: challenge.currency,
        status: 'COMPLETED',
        reference: winnerReference,
        description: `Won ${challenge.gameName} challenge`,
        balanceBefore: winnerBalanceBefore,
        balanceAfter: winnerBalanceAfter,
        metadata: { challengeId: challenge._id }
      });
    }

    // Notify winner
    await Notification.create({
      userId: challenge.winner,
      type: 'PAYMENT',
      title: 'Challenge Settled!',
      message: `You won ₦${winnerPayout.toLocaleString()} from your ${challenge.gameName} challenge!`,
      data: { challengeId: challenge._id }
    });

    // Notify loser
    if (challenge.loser) {
      await Notification.create({
        userId: challenge.loser,
        type: 'CHALLENGE',
        title: 'Challenge Settled',
        message: `Match settled. Better luck next time!`,
        data: { challengeId: challenge._id }
      });
    }
  }

  // Pay witness fee (always, even for draws)
  const witnessWallet = await Wallet.findOne({ userId: challenge.witness });
  if (witnessWallet) {
    const witnessBalanceBefore = witnessWallet.getBalance(challenge.currency as any);
    await witnessWallet.updateBalance(challenge.currency as any, witnessFeeAmount);
    const witnessBalanceAfter = witnessWallet.getBalance(challenge.currency as any);
    const witnessReference = `WITNESS_${challenge._id}_${Date.now()}`;

    await Transaction.create({
      userId: challenge.witness,
      walletId: witnessWallet._id,
      type: 'WITNESS_REWARD',
      amount: witnessFeeAmount,
      currency: challenge.currency,
      status: 'COMPLETED',
      reference: witnessReference,
      description: `Witness fee for ${challenge.gameName} challenge`,
      balanceBefore: witnessBalanceBefore,
      balanceAfter: witnessBalanceAfter,
      metadata: { challengeId: challenge._id }
    });

    // Notify witness
    await Notification.create({
      userId: challenge.witness,
      type: 'PAYMENT',
      title: 'Witness Fee Received',
      message: `You received ₦${witnessFeeAmount.toLocaleString()} for witnessing a challenge`,
      data: { challengeId: challenge._id }
    });
  }

  // Platform fee is already deducted (not added to any wallet)

  // Update witness reputation and stats (successful settlement)
  const witnessUser = await User.findById(challenge.witness);
  if (witnessUser) {
    witnessUser.totalWitnessedMatches += 1;
    witnessUser.successfulWitnesses += 1;
    
    // Increase reputation by 0.5% (max 100)
    if (witnessUser.witnessReputation < 100) {
      witnessUser.witnessReputation = Math.min(100, witnessUser.witnessReputation + 0.5);
    }
    
    await witnessUser.save();
    console.log(`[WITNESS] ${witnessUser.displayName} reputation increased to ${witnessUser.witnessReputation}%`);
  }

  challenge.status = 'SETTLED';
  challenge.settledAt = new Date();
  await challenge.save();

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
