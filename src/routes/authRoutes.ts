import { Router } from 'express';
import { register, login, getMe, refreshToken } from '../controllers/authController';
import { googleAuth, googleAuthCallback, googleMobileAuth } from '../controllers/googleAuthController';
import { forgotPassword, verifyResetOTP, resetPassword } from '../controllers/passwordResetController';
import { registerValidator, loginValidator } from '../validators/authValidator';
import { forgotPasswordValidator, verifyResetOTPValidator, resetPasswordValidator } from '../validators/passwordResetValidator';
import { protect } from '../middlewares/auth';

const router = Router();

router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/refresh-token', refreshToken);
router.get('/me', protect, getMe);

// Web Google OAuth
router.get('/google', googleAuth);
router.get('/google/callback', googleAuthCallback);

// Mobile Google Sign-In
router.post('/google/mobile', googleMobileAuth);

// Password reset routes
router.post('/forgot-password', forgotPasswordValidator, forgotPassword);
router.post('/verify-reset-otp', verifyResetOTPValidator, verifyResetOTP);
router.post('/reset-password', resetPasswordValidator, resetPassword);

export default router;
