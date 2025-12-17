import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { authService } from '../services/auth.service';
import { walletService } from '../services/wallet.service';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.middleware';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('username').isLength({ min: 3, max: 30 }).trim(),
    body('password').isLength({ min: 8 }),
    body('walletAddress').optional().isString(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { email, username, password, walletAddress } = req.body;
    const result = await authService.register(email, username, password, walletAddress);

    res.status(201).json({
      success: true,
      data: result,
      message: 'Registration successful',
    });
  })
);

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { email, password } = req.body;
    const result = await authService.login(email, password);

    res.json({
      success: true,
      data: result,
      message: 'Login successful',
    });
  })
);

router.post(
  '/wallet/nonce',
  [body('address').isString().notEmpty()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { address } = req.body;
    
    if (!walletService.isValidAddress(address)) {
      res.status(400).json({ success: false, error: 'Invalid wallet address' });
      return;
    }

    const nonceData = walletService.generateNonce(address);

    res.json({
      success: true,
      data: nonceData,
    });
  })
);

router.post(
  '/wallet/verify',
  [
    body('address').isString().notEmpty(),
    body('message').isString().notEmpty(),
    body('signature').isString().notEmpty(),
    body('chainId').isInt(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { address, message, signature, chainId } = req.body;
    const result = await authService.loginWithWallet({ address, message, signature, chainId });

    res.json({
      success: true,
      data: result,
      message: 'Wallet authentication successful',
    });
  })
);

router.post(
  '/refresh',
  [body('refreshToken').isString().notEmpty()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const { refreshToken } = req.body;
    const tokens = await authService.refreshTokens(refreshToken);

    res.json({
      success: true,
      data: tokens,
    });
  })
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    await authService.logout(authReq.sessionId);

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  })
);

router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    await authService.logoutAll(authReq.user.sub);

    res.json({
      success: true,
      message: 'Logged out from all devices',
    });
  })
);

router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    const user = authService.getUserById(authReq.user.sub);

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const { passwordHash: _p, mfaSecret: _m, ...sanitizedUser } = user;

    res.json({
      success: true,
      data: sanitizedUser,
    });
  })
);

export default router;
