import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';

const router = Router();
const inventoryController = new InventoryController();

router.get('/:playerId', inventoryController.getInventory);
router.get('/:playerId/stats', inventoryController.getInventoryStats);
router.get('/:playerId/nft', inventoryController.getNFTItems);

router.post('/:playerId/items/:itemId/lock', inventoryController.lockItem);
router.post('/:playerId/items/:itemId/unlock', inventoryController.unlockItem);
router.put('/:playerId/items/:itemId/favorite', inventoryController.setFavorite);
router.delete('/:playerId/items/:itemId', inventoryController.discardItem);

router.get('/:playerId/items/:itemId/duplicates', inventoryController.checkDuplicates);

export default router;
