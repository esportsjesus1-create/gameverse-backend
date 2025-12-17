import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as voiceChatController from '../controllers/voiceChatController';

const router = Router();

router.use(authMiddleware);

router.get('/me', voiceChatController.getUserVoiceStatus);

router.post('/party/:partyId', voiceChatController.createVoiceChannel);
router.get('/party/:partyId', voiceChatController.getPartyVoiceChannel);

router.get('/:channelId', voiceChatController.getVoiceChannel);
router.delete('/:channelId', voiceChatController.deleteVoiceChannel);

router.post('/:channelId/join', voiceChatController.joinVoiceChannel);
router.post('/:channelId/leave', voiceChatController.leaveVoiceChannel);

router.patch('/:channelId/status', voiceChatController.updateVoiceStatus);
router.post('/:channelId/speaking', voiceChatController.setSpeakingStatus);

router.get('/:channelId/participants', voiceChatController.getChannelParticipants);
router.post('/:channelId/participants/:targetUserId/mute', voiceChatController.muteParticipant);
router.post('/:channelId/participants/:targetUserId/unmute', voiceChatController.unmuteParticipant);

export default router;
