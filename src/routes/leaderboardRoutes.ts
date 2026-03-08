import express from 'express';
import {
  getTopEarners,
  getTopWitnesses,
  getTopWinRate,
  getLiveChallenges,
  getFeaturedChallenges,
  getPlayerOfTheWeek,
  getMatchOfTheWeek,
  getPlatformStats,
  getTrendingGames,
  getPopularPlatforms,
  getRecentHighlights,
  getRisingStars
} from '../controllers/leaderboardController';
import { protect } from '../middlewares/auth';

const router = express.Router();

// All routes are protected (require authentication)
router.use(protect);

// ══════════════════════════════════════════════════════════════════════════════
// LEADERBOARDS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/top-earners', getTopEarners);
router.get('/top-witnesses', getTopWitnesses);
router.get('/top-win-rate', getTopWinRate);
router.get('/rising-stars', getRisingStars);

// ══════════════════════════════════════════════════════════════════════════════
// CHALLENGES
// ══════════════════════════════════════════════════════════════════════════════
router.get('/live-challenges', getLiveChallenges);
router.get('/featured-challenges', getFeaturedChallenges);
router.get('/recent-highlights', getRecentHighlights);

// ══════════════════════════════════════════════════════════════════════════════
// WEEKLY FEATURES
// ══════════════════════════════════════════════════════════════════════════════
router.get('/player-of-the-week', getPlayerOfTheWeek);
router.get('/match-of-the-week', getMatchOfTheWeek);

// ══════════════════════════════════════════════════════════════════════════════
// PLATFORM INSIGHTS
// ══════════════════════════════════════════════════════════════════════════════
router.get('/platform-stats', getPlatformStats);
router.get('/trending-games', getTrendingGames);
router.get('/popular-platforms', getPopularPlatforms);

export default router;
