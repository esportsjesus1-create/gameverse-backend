import { Router } from 'express';
import * as playerController from '../controllers/playerController';

const router = Router();

router.post('/', playerController.createPlayer);

router.get('/:id', playerController.getPlayer);

router.put('/:id', playerController.updatePlayer);

router.delete('/:id', playerController.deletePlayer);

export default router;
