import { Router } from 'express';
import { inventoryController } from '../controllers';
import { validate, inventoryValidation } from '../middleware/validation';

const router = Router();

router.get('/low-stock', inventoryController.getLowStockItems.bind(inventoryController));

router.get(
  '/',
  validate(inventoryValidation.list),
  inventoryController.findAll.bind(inventoryController)
);

router.get(
  '/:itemId',
  validate(inventoryValidation.getByItemId),
  inventoryController.findByItemId.bind(inventoryController)
);

router.get(
  '/:itemId/history',
  validate(inventoryValidation.history),
  inventoryController.getHistory.bind(inventoryController)
);

router.post(
  '/',
  validate(inventoryValidation.create),
  inventoryController.create.bind(inventoryController)
);

router.put(
  '/:itemId',
  validate(inventoryValidation.update),
  inventoryController.update.bind(inventoryController)
);

router.post(
  '/:itemId/reserve',
  validate(inventoryValidation.reserve),
  inventoryController.reserve.bind(inventoryController)
);

router.post(
  '/:itemId/release',
  validate(inventoryValidation.release),
  inventoryController.release.bind(inventoryController)
);

export default router;
