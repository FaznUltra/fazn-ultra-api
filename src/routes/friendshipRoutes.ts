import { Router } from 'express';
import {
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  blockUser,
  unblockUser,
  unfriend,
  getFriends,
  getPendingRequests,
  getSentRequests,
  getBlockedUsers
} from '../controllers/friendshipController';
import { sendFriendRequestValidator, blockUserValidator } from '../validators/friendshipValidator';
import { protect } from '../middlewares/auth';

const router = Router();

router.use(protect);

router.post('/request', sendFriendRequestValidator, sendFriendRequest);
router.put('/accept/:friendshipId', acceptFriendRequest);
router.delete('/reject/:friendshipId', rejectFriendRequest);
router.post('/block', blockUserValidator, blockUser);
router.delete('/unblock/:userId', unblockUser);
router.delete('/unfriend/:userId', unfriend);

router.get('/friends', getFriends);
router.get('/requests/pending', getPendingRequests);
router.get('/requests/sent', getSentRequests);
router.get('/blocked', getBlockedUsers);

export default router;
