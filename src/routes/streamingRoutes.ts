import { Router } from 'express';
import {
  youtubeAuth,
  youtubeCallback,
  twitchAuth,
  twitchCallback,
  disconnectYoutube,
  disconnectTwitch
} from '../controllers/streamingAuthController';
import { protect } from '../middlewares/auth';

const router = Router();

// YouTube OAuth routes
router.get('/youtube/auth', protect, youtubeAuth);
router.get('/youtube/callback', youtubeCallback);
router.delete('/youtube/disconnect', protect, disconnectYoutube);

// Twitch OAuth routes
router.get('/twitch/auth', protect, twitchAuth);
router.get('/twitch/callback', twitchCallback);
router.delete('/twitch/disconnect', protect, disconnectTwitch);

export default router;
