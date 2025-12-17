import { Router } from 'express';
import { itemController } from '../controllers';
import { validate, itemValidation } from '../middleware/validation';

const router = Router();

router.get('/categories', itemController.getCategories.bind(itemController));

router.get(
  '/',
  validate(itemValidation.search),
  itemController.findAll.bind(itemController)
);

router.get(
  '/:id',
  validate(itemValidation.getById),
  itemController.findById.bind(itemController)
);

router.post(
  '/',
  validate(itemValidation.create),
  itemController.create.bind(itemController)
);

router.put(
  '/:id',
  validate(itemValidation.update),
  itemController.update.bind(itemController)
);

router.delete(
  '/:id',
  validate(itemValidation.getById),
  itemController.delete.bind(itemController)
);

export default router;
