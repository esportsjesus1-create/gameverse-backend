import { Router } from 'express';
import itemRoutes from './item.routes';
import bundleRoutes from './bundle.routes';
import inventoryRoutes from './inventory.routes';

const router = Router();

router.use('/items', itemRoutes);
router.use('/bundles', bundleRoutes);
router.use('/inventory', inventoryRoutes);

export default router;
