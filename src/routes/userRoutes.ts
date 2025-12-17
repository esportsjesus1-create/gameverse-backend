import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as userController from '../controllers/userController';

const router = Router();

router.post('/', userController.createUser);
router.get('/search', userController.searchUsers);
router.get('/online', userController.getOnlineUsers);

router.use(authMiddleware);

router.get('/me', userController.getCurrentUser);
router.patch('/me', userController.updateUser);
router.post('/me/status', userController.setUserStatus);

router.get('/:userId', userController.getUser);

export default router;
