import { Router } from 'express';
import { guildBankController } from '../controllers';
import { authenticate } from '../middleware';
import { validateBody } from '../middleware';
import { CreateGuildBankSchema, CreateVaultSchema, WithdrawalPolicySchema } from '../types';

const router = Router();

// Guild Bank routes
router.post(
  '/',
  authenticate,
  validateBody(CreateGuildBankSchema),
  guildBankController.createBank.bind(guildBankController)
);

router.get(
  '/:bankId',
  authenticate,
  guildBankController.getBank.bind(guildBankController)
);

router.get(
  '/guild/:guildId',
  authenticate,
  guildBankController.getBankByGuildId.bind(guildBankController)
);

router.patch(
  '/:bankId',
  authenticate,
  guildBankController.updateBank.bind(guildBankController)
);

router.delete(
  '/:bankId',
  authenticate,
  guildBankController.deleteBank.bind(guildBankController)
);

// Vault routes
router.post(
  '/:bankId/vaults',
  authenticate,
  validateBody(CreateVaultSchema),
  guildBankController.createVault.bind(guildBankController)
);

router.get(
  '/:bankId/vaults',
  authenticate,
  guildBankController.getVaults.bind(guildBankController)
);

router.get(
  '/:bankId/vaults/:vaultId',
  authenticate,
  guildBankController.getVault.bind(guildBankController)
);

router.patch(
  '/:bankId/vaults/:vaultId',
  authenticate,
  guildBankController.updateVault.bind(guildBankController)
);

router.delete(
  '/:bankId/vaults/:vaultId',
  authenticate,
  guildBankController.deleteVault.bind(guildBankController)
);

// Withdrawal policy routes
router.get(
  '/:bankId/policy',
  authenticate,
  guildBankController.getWithdrawalPolicy.bind(guildBankController)
);

router.put(
  '/:bankId/policy',
  authenticate,
  validateBody(WithdrawalPolicySchema),
  guildBankController.updateWithdrawalPolicy.bind(guildBankController)
);

export default router;
