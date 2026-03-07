import { Router } from 'express';
import { sendVerificationOTP, verifyEmail, resendOTP } from '../controllers/otpController';
import { verifyOTPValidator } from '../validators/otpValidator';
import { protect } from '../middlewares/auth';

const router = Router();

router.use(protect);

router.post('/send', sendVerificationOTP);
router.post('/verify', verifyOTPValidator, verifyEmail);
router.post('/resend', resendOTP);

export default router;
