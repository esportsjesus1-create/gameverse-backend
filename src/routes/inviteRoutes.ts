import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as inviteController from '../controllers/inviteController';

const router = Router();

router.use(authMiddleware);

router.get('/received', inviteController.getUserInvites);
router.get('/sent', inviteController.getSentInvites);

router.get('/:inviteId', inviteController.getInvite);
router.post('/:inviteId/accept', inviteController.acceptInvite);
router.post('/:inviteId/decline', inviteController.declineInvite);
router.delete('/:inviteId', inviteController.cancelInvite);

router.post('/party/:partyId', inviteController.sendInvite);
router.post('/party/:partyId/bulk', inviteController.sendBulkInvites);
router.get('/party/:partyId', inviteController.getPartyInvites);

export default router;
