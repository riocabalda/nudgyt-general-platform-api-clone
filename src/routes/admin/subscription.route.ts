import express from 'express';
import subscriptionController from '../../controllers/admin/subscription.controller';
import requirePermissions from '../../middlewares/require-permissions';

const router = express.Router({ mergeParams: true });

router.get(
  '/current',
  requirePermissions(['VIEW_ORGANIZATION_SUBSCRIPTION']),
  subscriptionController.getCurrentSubscription
);

export default router;
