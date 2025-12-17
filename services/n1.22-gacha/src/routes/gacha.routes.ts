import { Router } from 'express';
import { GachaController } from '../controllers/gacha.controller';
import {
  validateBody,
  validateParams,
  pullRequestSchema,
  createBannerSchema,
  createItemSchema,
  idParamSchema,
  playerIdParamSchema,
} from '../middleware';
import { z } from 'zod';

const router = Router();
const controller = new GachaController();

const multiPullSchema = z.object({
  playerId: z.string().uuid(),
  bannerId: z.string().uuid(),
});

const simulateSchema = z.object({
  bannerId: z.string().uuid(),
  count: z.number().int().min(1).max(100000),
});

router.get('/health', controller.healthCheck);

router.post('/pull', validateBody(pullRequestSchema), controller.executePull);

router.post('/pull/multi', validateBody(multiPullSchema), controller.executeMultiPull);

router.get('/banners', controller.getActiveBanners);

router.get('/banners/:id', validateParams(idParamSchema), controller.getBannerById);

router.get(
  '/history/:playerId',
  validateParams(playerIdParamSchema),
  controller.getPullHistory
);

router.get(
  '/pity/:playerId',
  validateParams(playerIdParamSchema),
  controller.getPityStatus
);

router.post('/admin/banner', validateBody(createBannerSchema), controller.createBanner);

router.put(
  '/admin/banner/:id',
  validateParams(idParamSchema),
  controller.updateBanner
);

router.delete(
  '/admin/banner/:id',
  validateParams(idParamSchema),
  controller.deleteBanner
);

router.post('/admin/items', validateBody(createItemSchema), controller.createItem);

router.get('/admin/items', controller.getItems);

router.put('/admin/items/:id', validateParams(idParamSchema), controller.updateItem);

router.delete('/admin/items/:id', validateParams(idParamSchema), controller.deleteItem);

router.post('/simulate', validateBody(simulateSchema), controller.simulatePulls);

export default router;
