import express from 'express';
import environmentController from '../../controllers/trainer/environment.controller';
import requirePermissions from '../../middlewares/require-permissions';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  requirePermissions(['Environment.View']),
  environmentController.getEnvironments
);
router.get(
  '/:id',
  requirePermissions(['Environment.View']),
  environmentController.getEnvironmentById
);
export default router;
