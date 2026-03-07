import { Router } from 'express';
import {
  getSupportTickets,
  getTicketById,
  createSupportTicket,
  addMessageToTicket,
  closeTicket,
  getTicketStats
} from '../controllers/supportController';
import { protect } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(protect);

router.get('/', getSupportTickets);
router.get('/stats', getTicketStats);
router.get('/:id', getTicketById);
router.post('/', createSupportTicket);
router.post('/:id/message', addMessageToTicket);
router.patch('/:id/close', closeTicket);

export default router;
