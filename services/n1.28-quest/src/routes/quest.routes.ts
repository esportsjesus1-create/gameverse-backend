import { Router } from 'express';
import { questController } from '../controllers/quest.controller';
import { validate } from '../middleware/validate';
import { createQuestSchema, paginationSchema, questFilterSchema, uuidSchema } from '../utils/validation';
import { z } from 'zod';

const router = Router();

router.post(
  '/',
  validate(createQuestSchema),
  questController.createQuest.bind(questController)
);

router.get(
  '/',
  validate(paginationSchema.merge(questFilterSchema), 'query'),
  questController.getQuests.bind(questController)
);

router.get(
  '/active',
  questController.getActiveQuests.bind(questController)
);

router.get(
  '/:id',
  validate(z.object({ id: uuidSchema }), 'params'),
  questController.getQuest.bind(questController)
);

router.patch(
  '/:id/status',
  validate(z.object({ id: uuidSchema }), 'params'),
  validate(z.object({ status: z.enum(['active', 'inactive', 'expired']) })),
  questController.updateQuestStatus.bind(questController)
);

router.delete(
  '/:id',
  validate(z.object({ id: uuidSchema }), 'params'),
  questController.deleteQuest.bind(questController)
);

export default router;
