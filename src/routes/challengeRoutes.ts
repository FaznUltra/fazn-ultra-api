import { Router } from 'express';
import {
  getAvailableGames,
  getChallengeHistory,
  getChallengeById,
  getPublicChallenges,
  getFriendsChallenges,
  getWitnessingChallenges,
  volunteerAsWitness,
  getMyWitnessingChallenges,
  createChallenge,
  acceptChallenge,
  rejectChallenge,
  cancelChallenge,
  updateStreamingLink,
  shareRoomCode,
  confirmJoinedRoom,
  startMatch,
  submitResult,
  settleChallenge,
  getChallengeStats
} from '../controllers/challengeController';
import { protect } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(protect);

// Get available games (no auth needed but included for consistency)
router.get('/games', getAvailableGames);

// Get challenges
router.get('/history', getChallengeHistory);
router.get('/public', getPublicChallenges);
router.get('/friends', getFriendsChallenges);
router.get('/witnessing', getWitnessingChallenges);
router.get('/my-witnessing', getMyWitnessingChallenges);
router.get('/stats', getChallengeStats);
router.get('/:id', getChallengeById);

// Create challenge
router.post('/', createChallenge);

// Challenge actions
router.post('/:id/accept', acceptChallenge);
router.post('/:id/reject', rejectChallenge);
router.post('/:id/cancel', cancelChallenge);
router.post('/:id/volunteer-witness', volunteerAsWitness);
router.patch('/:id/streaming-link', updateStreamingLink);

// Room code and match start
router.post('/:id/share-room-code', shareRoomCode);
router.post('/:id/confirm-joined', confirmJoinedRoom);
router.post('/:id/start-match', startMatch);

// Result submission and settlement
router.post('/:id/result', submitResult);
router.post('/:id/settle', settleChallenge);

export default router;
