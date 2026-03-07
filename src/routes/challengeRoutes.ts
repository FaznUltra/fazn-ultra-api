import { Router } from 'express';
import {
  getChallengeHistory,
  getChallengeById,
  createChallenge,
  acceptChallenge,
  cancelChallenge,
  getChallengeStats
} from '../controllers/challengeController';
import { protect } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(protect);

router.get('/', getChallengeHistory);
router.get('/stats', getChallengeStats);
router.get('/:id', getChallengeById);
router.post('/', createChallenge);
router.post('/:id/accept', acceptChallenge);
router.post('/:id/cancel', cancelChallenge);

export default router;
