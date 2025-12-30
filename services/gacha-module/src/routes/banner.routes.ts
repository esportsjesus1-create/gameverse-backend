import { Router } from 'express';
import { BannerController } from '../controllers/banner.controller';

const router = Router();
const bannerController = new BannerController();

router.get('/', bannerController.getAllBanners);
router.get('/active', bannerController.getActiveBanners);
router.get('/type/:type', bannerController.getBannersByType);
router.get('/:bannerId', bannerController.getBanner);
router.post('/', bannerController.createBanner);
router.put('/:bannerId', bannerController.updateBanner);
router.delete('/:bannerId', bannerController.deleteBanner);

router.get('/:bannerId/drop-rates', bannerController.getDropRates);
router.get('/drop-rates/all', bannerController.getAllDropRates);

export default router;
