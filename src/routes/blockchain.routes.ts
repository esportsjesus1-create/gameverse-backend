import { Router } from 'express';
import { blockchainController } from '../controllers/blockchain.controller';
import { authenticate, requireSameUser } from '../middleware/auth.middleware';
import {
  validate,
  validateParams,
  linkAddressSchema,
  updateAddressLabelSchema,
  idParamSchema,
} from '../middleware/validation.middleware';
import { z } from 'zod';

const router = Router();

const addressIdParamSchema = z.object({
  id: z.string().uuid('Invalid user ID format'),
  addressId: z.string().uuid('Invalid address ID format'),
});

router.post(
  '/:id/addresses',
  authenticate,
  requireSameUser,
  validateParams(idParamSchema),
  validate(linkAddressSchema),
  blockchainController.linkAddress
);

router.get(
  '/:id/addresses',
  authenticate,
  requireSameUser,
  validateParams(idParamSchema),
  blockchainController.getAddresses
);

router.get(
  '/:id/addresses/signing-message',
  authenticate,
  requireSameUser,
  validateParams(idParamSchema),
  blockchainController.getSigningMessage
);

router.get(
  '/:id/addresses/:addressId',
  authenticate,
  requireSameUser,
  validateParams(addressIdParamSchema),
  blockchainController.getAddress
);

router.patch(
  '/:id/addresses/:addressId/primary',
  authenticate,
  requireSameUser,
  validateParams(addressIdParamSchema),
  blockchainController.setPrimaryAddress
);

router.patch(
  '/:id/addresses/:addressId/label',
  authenticate,
  requireSameUser,
  validateParams(addressIdParamSchema),
  validate(updateAddressLabelSchema),
  blockchainController.updateAddressLabel
);

router.delete(
  '/:id/addresses/:addressId',
  authenticate,
  requireSameUser,
  validateParams(addressIdParamSchema),
  blockchainController.unlinkAddress
);

export default router;
