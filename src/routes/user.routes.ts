import { Router } from 'express';
import multer from 'multer';
import { userController } from '../controllers/user.controller';
import { authenticate, requireSameUser, requireRole } from '../middleware/auth.middleware';
import {
  validate,
  validateParams,
  validateQuery,
  createUserSchema,
  updateUserSchema,
  updateKycStatusSchema,
  paginationSchema,
  idParamSchema,
  exportFormatSchema,
} from '../middleware/validation.middleware';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

router.post('/', validate(createUserSchema), userController.createUser);

router.get(
  '/',
  authenticate,
  requireRole('admin'),
  validateQuery(paginationSchema),
  userController.getAllUsers
);

router.get('/search', userController.getUserByEmail);

router.get('/verify/:token', userController.verifyEmail);

router.get('/:id', validateParams(idParamSchema), userController.getUser);

router.patch(
  '/:id',
  authenticate,
  requireSameUser,
  validateParams(idParamSchema),
  validate(updateUserSchema),
  userController.updateUser
);

router.delete(
  '/:id',
  authenticate,
  requireSameUser,
  validateParams(idParamSchema),
  userController.deleteUser
);

router.post(
  '/:id/avatar',
  authenticate,
  requireSameUser,
  validateParams(idParamSchema),
  upload.single('avatar'),
  userController.uploadAvatar
);

router.post(
  '/:id/resend-verification',
  authenticate,
  requireSameUser,
  validateParams(idParamSchema),
  userController.resendVerification
);

router.patch(
  '/:id/kyc',
  authenticate,
  requireRole('admin'),
  validateParams(idParamSchema),
  validate(updateKycStatusSchema),
  userController.updateKycStatus
);

router.get(
  '/:id/kyc/history',
  authenticate,
  requireSameUser,
  validateParams(idParamSchema),
  userController.getKycHistory
);

router.get(
  '/:id/export',
  authenticate,
  requireSameUser,
  validateParams(idParamSchema),
  validateQuery(exportFormatSchema),
  userController.exportData
);

router.post(
  '/:id/anonymize',
  authenticate,
  requireSameUser,
  validateParams(idParamSchema),
  userController.anonymizeUser
);

export default router;
