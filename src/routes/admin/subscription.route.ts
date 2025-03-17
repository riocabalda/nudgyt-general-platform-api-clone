import express from 'express';
import subscriptionController from '../../controllers/admin/subscription.controller';
import requirePermissions from '../../middlewares/require-permissions';

const router = express.Router({ mergeParams: true });

router.get(
  '/current',
  requirePermissions(['Organization.Subscription.View']),
  subscriptionController.getCurrentSubscription
);

export default router;
