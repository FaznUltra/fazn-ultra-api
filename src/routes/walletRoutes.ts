import { Router } from 'express';
import {
  getWallet,
  initializeDeposit,
  verifyDeposit,
  getTransactions,
  getTransaction,
  getTransactionAnalytics
} from '../controllers/walletController';
import { depositValidator } from '../validators/walletValidator';
import { protect } from '../middlewares/auth';

const router = Router();

router.use(protect);

router.get('/', getWallet);
router.post('/deposit/initialize', depositValidator, initializeDeposit);
router.get('/deposit/verify/:reference', verifyDeposit);
router.get('/transactions/analytics', getTransactionAnalytics);
router.get('/transactions/:id', getTransaction);
router.get('/transactions', getTransactions);

export default router;
