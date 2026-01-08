import { Router } from 'express';
import { bundleController } from '../controllers';
import { validate, bundleValidation } from '../middleware/validation';

const router = Router();

router.get(
  '/',
  validate(bundleValidation.list),
  bundleController.findAll.bind(bundleController)
);

router.get(
  '/:id',
  validate(bundleValidation.getById),
  bundleController.findById.bind(bundleController)
);

router.post(
  '/',
  validate(bundleValidation.create),
  bundleController.create.bind(bundleController)
);

router.put(
  '/:id',
  validate(bundleValidation.update),
  bundleController.update.bind(bundleController)
);

router.delete(
  '/:id',
  validate(bundleValidation.getById),
  bundleController.delete.bind(bundleController)
);

export default router;
