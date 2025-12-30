import { Router } from 'express';
import gachaRoutes from './gacha.routes';
import bannerRoutes from './banner.routes';
import currencyRoutes from './currency.routes';
import inventoryRoutes from './inventory.routes';
import complianceRoutes from './compliance.routes';
import itemRoutes from './item.routes';
import nftRoutes from './nft.routes';

const router = Router();

router.use('/gacha', gachaRoutes);
router.use('/banners', bannerRoutes);
router.use('/currency', currencyRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/compliance', complianceRoutes);
router.use('/items', itemRoutes);
router.use('/nft', nftRoutes);

export default router;
