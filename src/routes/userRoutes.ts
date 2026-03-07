import { Router } from 'express';
import { searchUsers, getUserProfile, updateProfile } from '../controllers/userController';
import { updateProfileValidator } from '../validators/userValidator';
import { protect } from '../middlewares/auth';

const router = Router();

router.use(protect);

router.get('/search', searchUsers);
router.get('/:userId', getUserProfile);
router.put('/profile', updateProfileValidator, updateProfile);

export default router;
