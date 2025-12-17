import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';
import { tenantService } from '../services/tenant.service';

const router = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

router.post(
  '/',
  [
    body('name').isString().isLength({ min: 2, max: 100 }),
    body('slug').isString().isLength({ min: 2, max: 50 }).matches(/^[a-z0-9-]+$/),
    body('domain').optional().isString(),
    body('plan').optional().isIn(['free', 'starter', 'professional', 'enterprise']),
    body('ownerId').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const tenant = await tenantService.createTenant(req.body);

    res.status(201).json({
      success: true,
      data: tenant,
      message: 'Tenant created successfully',
    });
  })
);

router.get(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = await tenantService.getTenantById(req.params.id);

    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, data: tenant });
  })
);

router.get(
  '/slug/:slug',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = await tenantService.getTenantBySlug(req.params.slug);

    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, data: tenant });
  })
);

router.patch(
  '/:id',
  [
    param('id').isUUID(),
    body('name').optional().isString().isLength({ min: 2, max: 100 }),
    body('domain').optional().isString(),
    body('status').optional().isIn(['active', 'suspended', 'pending', 'archived']),
    body('plan').optional().isIn(['free', 'starter', 'professional', 'enterprise']),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const tenant = await tenantService.updateTenant(req.params.id, req.body);

    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, data: tenant, message: 'Tenant updated successfully' });
  })
);

router.post(
  '/:id/suspend',
  [
    param('id').isUUID(),
    body('reason').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = await tenantService.suspendTenant(req.params.id, req.body.reason);

    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, data: tenant, message: 'Tenant suspended' });
  })
);

router.post(
  '/:id/reactivate',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenant = await tenantService.reactivateTenant(req.params.id);

    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, data: tenant, message: 'Tenant reactivated' });
  })
);

router.delete(
  '/:id',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const deleted = await tenantService.deleteTenant(req.params.id);

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, message: 'Tenant deleted successfully' });
  })
);

router.get(
  '/:id/members',
  [param('id').isUUID()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const members = await tenantService.getTenantMembers(req.params.id);
    res.json({ success: true, data: members });
  })
);

router.post(
  '/:id/members',
  [
    param('id').isUUID(),
    body('userId').isString().notEmpty(),
    body('role').isIn(['admin', 'member', 'viewer']),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const member = await tenantService.addMember(
      req.params.id,
      req.body.userId,
      req.body.role,
      req.body.invitedBy
    );

    res.status(201).json({ success: true, data: member, message: 'Member added' });
  })
);

router.delete(
  '/:id/members/:userId',
  [param('id').isUUID(), param('userId').isString()],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const removed = await tenantService.removeMember(req.params.id, req.params.userId);

    if (!removed) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }

    res.json({ success: true, message: 'Member removed' });
  })
);

router.post(
  '/:id/invitations',
  [
    param('id').isUUID(),
    body('email').isEmail(),
    body('role').isIn(['admin', 'member', 'viewer']),
    body('invitedBy').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ success: false, errors: errors.array() });
      return;
    }

    const invitation = await tenantService.createInvitation(
      req.params.id,
      req.body.email,
      req.body.role,
      req.body.invitedBy
    );

    res.status(201).json({ success: true, data: invitation, message: 'Invitation sent' });
  })
);

router.post(
  '/invitations/accept',
  [
    body('token').isString().notEmpty(),
    body('userId').isString().notEmpty(),
  ],
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const member = await tenantService.acceptInvitation(req.body.token, req.body.userId);
    res.json({ success: true, data: member, message: 'Invitation accepted' });
  })
);

router.get(
  '/user/:userId',
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const tenants = await tenantService.getUserTenants(req.params.userId);
    res.json({ success: true, data: tenants });
  })
);

export default router;
