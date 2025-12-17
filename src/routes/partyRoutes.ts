import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as partyController from '../controllers/partyController';

const router = Router();

router.get('/public', partyController.getPublicParties);

router.use(authMiddleware);

router.post('/', partyController.createParty);
router.get('/me', partyController.getUserParty);
router.get('/:partyId', partyController.getParty);
router.patch('/:partyId', partyController.updateParty);
router.delete('/:partyId', partyController.disbandParty);

router.post('/:partyId/join', partyController.joinParty);
router.post('/:partyId/leave', partyController.leaveParty);

router.post('/:partyId/transfer-leadership', partyController.transferLeadership);
router.post('/:partyId/members/:memberId/promote', partyController.promoteToOfficer);
router.post('/:partyId/members/:memberId/demote', partyController.demoteToMember);
router.delete('/:partyId/members/:memberId', partyController.kickMember);

router.post('/:partyId/ready', partyController.setReadyStatus);
router.post('/:partyId/status', partyController.updatePartyStatus);

router.get('/:partyId/members', partyController.getPartyMembers);

export default router;
