import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { royaltyService } from '../services/royalty.service';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  '/configs',
  [
    body('nftContractAddress').isString().notEmpty(),
    body('tokenId').optional().isString(),
    body('collectionId').optional().isString(),
    body('totalRoyaltyBps').isInt({ min: 1, max: 2500 }),
    body('recipients').isArray({ min: 1 }),
    body('recipients.*.address').isString().notEmpty(),
    body('recipients.*.shareBps').isInt({ min: 1, max: 10000 }),
    body('createdBy').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const config = await royaltyService.createConfig(req.body);

    res.status(201).json({
      success: true,
      data: config,
      message: 'Royalty configuration created',
    });
  })
);

router.get(
  '/configs/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const config = await royaltyService.getConfigById(req.params.id);

    if (!config) {
      res.status(404).json({ success: false, error: 'Configuration not found' });
      return;
    }

    res.json({ success: true, data: config });
  })
);

router.get(
  '/configs/contract/:address',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tokenId = req.query.tokenId as string | undefined;
    const config = await royaltyService.getConfigByContract(req.params.address, tokenId);

    if (!config) {
      res.status(404).json({ success: false, error: 'Configuration not found' });
      return;
    }

    res.json({ success: true, data: config });
  })
);

router.patch(
  '/configs/:id',
  [
    param('id').isUUID(),
    body('totalRoyaltyBps').optional().isInt({ min: 1, max: 2500 }),
    body('recipients').optional().isArray({ min: 1 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const config = await royaltyService.updateConfig(req.params.id, req.body);

    if (!config) {
      res.status(404).json({ success: false, error: 'Configuration not found' });
      return;
    }

    res.json({ success: true, data: config, message: 'Configuration updated' });
  })
);

router.delete(
  '/configs/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const deactivated = await royaltyService.deactivateConfig(req.params.id);

    if (!deactivated) {
      res.status(404).json({ success: false, error: 'Configuration not found' });
      return;
    }

    res.json({ success: true, message: 'Configuration deactivated' });
  })
);

router.post(
  '/sales',
  [
    body('configId').isUUID(),
    body('saleId').isString().notEmpty(),
    body('saleAmount').isString().notEmpty(),
    body('saleCurrency').isIn(['ETH', 'MATIC', 'USDC', 'USDT', 'DAI']),
    body('chainId').isInt(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const payment = await royaltyService.recordSale(req.body);

    res.status(201).json({
      success: true,
      data: payment,
      message: 'Sale recorded and royalty payment created',
    });
  })
);

router.post(
  '/payments/:id/process',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const payment = await royaltyService.processPayment(req.params.id);

    res.json({
      success: true,
      data: payment,
      message: 'Payment processed successfully',
    });
  })
);

router.get(
  '/payments/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const payment = await royaltyService.getPaymentById(req.params.id);

    if (!payment) {
      res.status(404).json({ success: false, error: 'Payment not found' });
      return;
    }

    res.json({ success: true, data: payment });
  })
);

router.get(
  '/configs/:id/payments',
  [
    param('id').isUUID(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await royaltyService.getPaymentsByConfig(req.params.id, page, limit);

    res.json({ success: true, data: result });
  })
);

router.get(
  '/recipients/:address/history',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = await royaltyService.getRecipientHistory(req.params.address, page, limit);

    res.json({ success: true, data: result });
  })
);

router.get(
  '/recipients/:address/summary',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const summary = await royaltyService.getRecipientSummary(req.params.address);

    res.json({ success: true, data: summary });
  })
);

router.post(
  '/calculate',
  [
    body('saleAmount').isString().notEmpty(),
    body('royaltyBps').isInt({ min: 1, max: 2500 }),
    body('recipients').optional().isArray(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { saleAmount, royaltyBps, recipients } = req.body;

    const totalRoyalty = royaltyService.calculateRoyalty(saleAmount, royaltyBps);

    let splits: { address: string; shareBps: number; amount: string }[] = [];
    if (recipients && Array.isArray(recipients)) {
      splits = recipients.map((r: { address: string; shareBps: number }) => ({
        address: r.address,
        shareBps: r.shareBps,
        amount: royaltyService.calculateSplit(totalRoyalty, r.shareBps),
      }));
    }

    res.json({
      success: true,
      data: {
        saleAmount,
        royaltyBps,
        totalRoyalty,
        splits,
      },
    });
  })
);

export default router;
