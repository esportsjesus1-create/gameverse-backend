import { Router } from 'express';
import partyRoutes from './partyRoutes';
import inviteRoutes from './inviteRoutes';
import voiceChatRoutes from './voiceChatRoutes';
import benefitsRoutes from './benefitsRoutes';
import userRoutes from './userRoutes';

const router = Router();

router.use('/parties', partyRoutes);
router.use('/invites', inviteRoutes);
router.use('/voice', voiceChatRoutes);
router.use('/benefits', benefitsRoutes);
router.use('/users', userRoutes);

export default router;
