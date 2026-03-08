import { Response } from 'express';
import { AuthRequest } from '../types';
import User from '../models/User';
import Challenge from '../models/Challenge';
import asyncHandler from '../utils/asyncHandler';

// ══════════════════════════════════════════════════════════════════════════════
// TOP EARNERS LEADERBOARD
// ══════════════════════════════════════════════════════════════════════════════
export const getTopEarners = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 10, period = 'all-time' } = req.query;

  const topEarners = await User.find({ isActive: true })
    .select('displayName firstName lastName profileImage stats isVerified')
    .sort({ 'stats.totalEarnings': -1 })
    .limit(Number(limit));

  const leaderboard = topEarners.map((user, index) => ({
    rank: index + 1,
    userId: user._id,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImage: user.profileImage,
    isVerified: user.isVerified,
    totalEarnings: user.stats.totalEarnings,
    wins: user.stats.wins,
    totalChallenges: user.stats.totalChallenges,
    winRate: user.stats.totalChallenges > 0 
      ? Math.round((user.stats.wins / user.stats.totalChallenges) * 100) 
      : 0
  }));

  res.json({
    success: true,
    data: {
      leaderboard,
      period,
      total: topEarners.length
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TOP WITNESSES LEADERBOARD
// ══════════════════════════════════════════════════════════════════════════════
export const getTopWitnesses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 10 } = req.query;

  const topWitnesses = await User.find({ 
    isActive: true,
    totalWitnessedMatches: { $gt: 0 }
  })
    .select('displayName firstName lastName profileImage witnessReputation totalWitnessedMatches successfulWitnesses stats isVerified')
    .sort({ witnessReputation: -1, totalWitnessedMatches: -1 })
    .limit(Number(limit));

  const leaderboard = topWitnesses.map((user, index) => ({
    rank: index + 1,
    userId: user._id,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImage: user.profileImage,
    isVerified: user.isVerified,
    witnessReputation: user.witnessReputation,
    totalWitnessedMatches: user.totalWitnessedMatches,
    successfulWitnesses: user.successfulWitnesses,
    witnessEarnings: user.stats.totalEarnings,
    successRate: user.totalWitnessedMatches > 0
      ? Math.round((user.successfulWitnesses / user.totalWitnessedMatches) * 100)
      : 0
  }));

  res.json({
    success: true,
    data: {
      leaderboard,
      total: topWitnesses.length
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TOP WIN RATE LEADERBOARD (min 10 challenges)
// ══════════════════════════════════════════════════════════════════════════════
export const getTopWinRate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 10, minChallenges = 10 } = req.query;

  const users = await User.find({ 
    isActive: true,
    'stats.totalChallenges': { $gte: Number(minChallenges) }
  })
    .select('displayName firstName lastName profileImage stats isVerified');

  // Calculate win rate and sort
  const usersWithWinRate = users.map(user => ({
    userId: user._id,
    displayName: user.displayName,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImage: user.profileImage,
    isVerified: user.isVerified,
    wins: user.stats.wins,
    losses: user.stats.losses,
    draws: user.stats.draws,
    totalChallenges: user.stats.totalChallenges,
    winRate: user.stats.totalChallenges > 0
      ? Math.round((user.stats.wins / user.stats.totalChallenges) * 100)
      : 0,
    totalEarnings: user.stats.totalEarnings
  }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, Number(limit));

  const leaderboard = usersWithWinRate.map((user, index) => ({
    rank: index + 1,
    ...user
  }));

  res.json({
    success: true,
    data: {
      leaderboard,
      minChallenges: Number(minChallenges),
      total: usersWithWinRate.length
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// LIVE CHALLENGES (currently in LIVE status)
// ══════════════════════════════════════════════════════════════════════════════
export const getLiveChallenges = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 20, page = 1 } = req.query;

  const liveChallenges = await Challenge.find({ status: 'LIVE' })
    .populate('creator', 'displayName profileImage isVerified')
    .populate('acceptor', 'displayName profileImage isVerified')
    .populate('witness', 'displayName profileImage witnessReputation')
    .sort({ matchStartedAt: -1 })
    .limit(Number(limit))
    .skip((Number(page) - 1) * Number(limit));

  const total = await Challenge.countDocuments({ status: 'LIVE' });

  res.json({
    success: true,
    data: {
      challenges: liveChallenges,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FEATURED CHALLENGES (high stakes, verified players)
// ══════════════════════════════════════════════════════════════════════════════
export const getFeaturedChallenges = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 10 } = req.query;

  const featuredChallenges = await Challenge.find({
    status: { $in: ['LIVE', 'ACCEPTED', 'COMPLETED'] },
    stakeAmount: { $gte: 5000 } // High stakes challenges
  })
    .populate('creator', 'displayName profileImage isVerified stats')
    .populate('acceptor', 'displayName profileImage isVerified stats')
    .populate('witness', 'displayName profileImage witnessReputation')
    .sort({ stakeAmount: -1, createdAt: -1 })
    .limit(Number(limit));

  res.json({
    success: true,
    data: {
      challenges: featuredChallenges,
      total: featuredChallenges.length
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PLAYER OF THE WEEK (most wins in last 7 days)
// ══════════════════════════════════════════════════════════════════════════════
export const getPlayerOfTheWeek = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get all settled challenges from the last 7 days
  const recentChallenges = await Challenge.find({
    status: 'SETTLED',
    settledAt: { $gte: sevenDaysAgo }
  }).select('winner winnerUsername creator acceptor');

  // Count wins per player
  const winCounts = new Map<string, { userId: string; wins: number }>();
  
  recentChallenges.forEach(challenge => {
    if (challenge.winner) {
      const winnerId = challenge.winner.toString();
      const current = winCounts.get(winnerId) || { userId: winnerId, wins: 0 };
      winCounts.set(winnerId, { ...current, wins: current.wins + 1 });
    }
  });

  // Find player with most wins
  let topPlayerId: string | null = null;
  let maxWins = 0;

  winCounts.forEach((data, userId) => {
    if (data.wins > maxWins) {
      maxWins = data.wins;
      topPlayerId = userId;
    }
  });

  if (!topPlayerId) {
    res.json({
      success: true,
      data: { player: null, message: 'No player of the week yet' }
    });
    return;
  }

  // Get full player details
  const player = await User.findById(topPlayerId)
    .select('displayName firstName lastName profileImage stats isVerified');

  res.json({
    success: true,
    data: {
      player: {
        userId: player?._id,
        displayName: player?.displayName,
        firstName: player?.firstName,
        lastName: player?.lastName,
        profileImage: player?.profileImage,
        isVerified: player?.isVerified,
        weeklyWins: maxWins,
        totalWins: player?.stats.wins,
        totalEarnings: player?.stats.totalEarnings,
        winRate: player && player.stats.totalChallenges > 0
          ? Math.round((player.stats.wins / player.stats.totalChallenges) * 100)
          : 0
      },
      period: {
        start: sevenDaysAgo,
        end: new Date()
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// MATCH OF THE WEEK (highest stake settled in last 7 days)
// ══════════════════════════════════════════════════════════════════════════════
export const getMatchOfTheWeek = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const topMatch = await Challenge.findOne({
    status: 'SETTLED',
    settledAt: { $gte: sevenDaysAgo }
  })
    .populate('creator', 'displayName profileImage isVerified stats')
    .populate('acceptor', 'displayName profileImage isVerified stats')
    .populate('witness', 'displayName profileImage witnessReputation')
    .sort({ stakeAmount: -1 })
    .limit(1);

  res.json({
    success: true,
    data: {
      match: topMatch,
      period: {
        start: sevenDaysAgo,
        end: new Date()
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PLATFORM STATISTICS (overall platform health)
// ══════════════════════════════════════════════════════════════════════════════
export const getPlatformStats = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const [
    totalUsers,
    activeUsers,
    totalChallenges,
    liveChallenges,
    settledChallenges,
    totalStaked,
    totalPaidOut
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    User.countDocuments({ 
      isActive: true,
      lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }),
    Challenge.countDocuments(),
    Challenge.countDocuments({ status: 'LIVE' }),
    Challenge.countDocuments({ status: 'SETTLED' }),
    Challenge.aggregate([
      { $match: { status: { $in: ['ACCEPTED', 'LIVE', 'COMPLETED', 'SETTLED'] } } },
      { $group: { _id: null, total: { $sum: '$totalPot' } } }
    ]),
    Challenge.aggregate([
      { $match: { status: 'SETTLED', winner: { $ne: null } } },
      { $group: { _id: null, total: { $sum: '$winnerPayout' } } }
    ])
  ]);

  res.json({
    success: true,
    data: {
      users: {
        total: totalUsers,
        activeThisWeek: activeUsers
      },
      challenges: {
        total: totalChallenges,
        live: liveChallenges,
        settled: settledChallenges
      },
      economy: {
        totalStaked: totalStaked[0]?.total || 0,
        totalPaidOut: totalPaidOut[0]?.total || 0
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// TRENDING GAMES (most played in last 7 days)
// ══════════════════════════════════════════════════════════════════════════════
export const getTrendingGames = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 10 } = req.query;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const trendingGames = await Challenge.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo },
        status: { $in: ['ACCEPTED', 'LIVE', 'COMPLETED', 'SETTLED'] }
      }
    },
    {
      $group: {
        _id: '$gameName',
        count: { $sum: 1 },
        totalStaked: { $sum: '$totalPot' },
        avgStake: { $avg: '$stakeAmount' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: Number(limit) }
  ]);

  const formattedGames = trendingGames.map((game, index) => ({
    rank: index + 1,
    gameName: game._id,
    challengeCount: game.count,
    totalStaked: Math.round(game.totalStaked),
    avgStake: Math.round(game.avgStake)
  }));

  res.json({
    success: true,
    data: {
      games: formattedGames,
      period: {
        start: sevenDaysAgo,
        end: new Date()
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// POPULAR PLATFORMS (most used gaming platforms)
// ══════════════════════════════════════════════════════════════════════════════
export const getPopularPlatforms = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 10 } = req.query;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const popularPlatforms = await Challenge.aggregate([
    {
      $match: {
        createdAt: { $gte: sevenDaysAgo },
        status: { $in: ['ACCEPTED', 'LIVE', 'COMPLETED', 'SETTLED'] }
      }
    },
    {
      $group: {
        _id: '$platform',
        count: { $sum: 1 },
        totalStaked: { $sum: '$totalPot' }
      }
    },
    { $sort: { count: -1 } },
    { $limit: Number(limit) }
  ]);

  const formattedPlatforms = popularPlatforms.map((platform, index) => ({
    rank: index + 1,
    platform: platform._id,
    challengeCount: platform.count,
    totalStaked: Math.round(platform.totalStaked)
  }));

  res.json({
    success: true,
    data: {
      platforms: formattedPlatforms,
      period: {
        start: sevenDaysAgo,
        end: new Date()
      }
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RECENT HIGHLIGHTS (recent big wins, upsets, etc)
// ══════════════════════════════════════════════════════════════════════════════
export const getRecentHighlights = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 10 } = req.query;

  // Get recent high-stake wins
  const recentHighlights = await Challenge.find({
    status: 'SETTLED',
    winner: { $ne: null },
    stakeAmount: { $gte: 1000 }
  })
    .populate('creator', 'displayName profileImage isVerified stats')
    .populate('acceptor', 'displayName profileImage isVerified stats')
    .populate('winner', 'displayName profileImage isVerified')
    .sort({ settledAt: -1 })
    .limit(Number(limit));

  const highlights = recentHighlights.map(challenge => ({
    challengeId: challenge._id,
    gameName: challenge.gameName,
    platform: challenge.platform,
    stakeAmount: challenge.stakeAmount,
    winnerPayout: challenge.winnerPayout,
    winner: {
      userId: challenge.winner?._id,
      displayName: (challenge.winner as any)?.displayName,
      profileImage: (challenge.winner as any)?.profileImage,
      isVerified: (challenge.winner as any)?.isVerified
    },
    finalScore: challenge.finalScore,
    settledAt: challenge.settledAt,
    isUpset: false // Could calculate based on player stats
  }));

  res.json({
    success: true,
    data: {
      highlights,
      total: highlights.length
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// RISING STARS (new players with high win rates)
// ══════════════════════════════════════════════════════════════════════════════
export const getRisingStars = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { limit = 10 } = req.query;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const risingStars = await User.find({
    isActive: true,
    createdAt: { $gte: thirtyDaysAgo },
    'stats.totalChallenges': { $gte: 5 },
    'stats.wins': { $gte: 3 }
  })
    .select('displayName firstName lastName profileImage stats isVerified createdAt');

  const starsWithWinRate = risingStars
    .map(user => ({
      userId: user._id,
      displayName: user.displayName,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImage: user.profileImage,
      isVerified: user.isVerified,
      wins: user.stats.wins,
      totalChallenges: user.stats.totalChallenges,
      totalEarnings: user.stats.totalEarnings,
      winRate: Math.round((user.stats.wins / user.stats.totalChallenges) * 100),
      accountAge: Math.floor((Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    }))
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, Number(limit));

  const leaderboard = starsWithWinRate.map((star, index) => ({
    rank: index + 1,
    ...star
  }));

  res.json({
    success: true,
    data: {
      leaderboard,
      total: starsWithWinRate.length
    }
  });
});
