import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController';
import { googleAuth, googleAuthCallback } from '../controllers/googleAuthController';
import { registerValidator, loginValidator } from '../validators/authValidator';
import { protect } from '../middlewares/auth';

const router = Router();

router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.get('/me', protect, getMe);

router.get('/google', googleAuth);
router.get('/google/callback', googleAuthCallback);

export default router;
