import { Router } from 'express';
import { GachaController } from '../controllers/gacha.controller';

const router = Router();
const gachaController = new GachaController();

router.get('/health', gachaController.healthCheck);

router.post('/pull', gachaController.executePull);
router.post('/pull/multi', gachaController.executeMultiPull);

router.get('/banners', gachaController.getActiveBanners);
router.get('/banners/:bannerId', gachaController.getBannerById);

router.get('/history/:playerId', gachaController.getPullHistory);

router.get('/pity/:playerId', gachaController.getPityStatus);
router.get('/pity/:playerId/banner/:bannerId', gachaController.getPityStatusForBanner);

router.get('/simulate/:bannerId', gachaController.simulatePulls);

export default router;
