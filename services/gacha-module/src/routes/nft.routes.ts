import { Router } from 'express';
import { NFTController } from '../controllers/nft.controller';

const router = Router();
const nftController = new NFTController();

router.get('/player/:playerId', nftController.getPlayerNFTRewards);
router.get('/player/:playerId/stats', nftController.getPlayerNFTStats);

router.get('/pull/:pullId', nftController.getNFTRewardByPull);

router.post('/mint/:rewardId', nftController.mintNFT);
router.post('/claim/:rewardId', nftController.claimNFT);

router.get('/pending', nftController.getPendingRewards);
router.post('/retry-failed', nftController.retryFailedMints);

export default router;
