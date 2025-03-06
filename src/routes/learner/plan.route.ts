import express from 'express';
import planController from '../../controllers/learner/plan.controller';
import requirePermissions from '../../middlewares/require-permissions';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  requirePermissions(['VIEW_SUBSCRIPTION']),
  planController.getPlans
);

export default router;
