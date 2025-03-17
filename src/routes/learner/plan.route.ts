import express from 'express';
import planController from '../../controllers/learner/plan.controller';
import requirePermissions from '../../middlewares/require-permissions';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  requirePermissions(['Account.Subscription.View']),
  planController.getPlans
);

export default router;
