import { Router } from 'express';
import { ItemController } from '../controllers/item.controller';

const router = Router();
const itemController = new ItemController();

router.get('/', itemController.getAllItems);
router.get('/:itemId', itemController.getItem);
router.post('/', itemController.createItem);
router.put('/:itemId', itemController.updateItem);
router.delete('/:itemId', itemController.deleteItem);

router.get('/pools/all', itemController.getAllPools);
router.get('/pools/:poolId', itemController.getPool);
router.post('/pools', itemController.createPool);
router.put('/pools/:poolId', itemController.updatePool);
router.delete('/pools/:poolId', itemController.deletePool);
router.post('/pools/:poolId/items', itemController.addItemsToPool);
router.delete('/pools/:poolId/items', itemController.removeItemsFromPool);

export default router;
