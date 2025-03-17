import express from 'express';
import serviceController from '../../controllers/learner/service.controller';
import requirePermissions from '../../middlewares/require-permissions';

const router = express.Router({ mergeParams: true });

router.get(
  '/most-popular',
  requirePermissions(['Dashboard.View']),
  serviceController.getMostPopularServices
);
router.get('/', serviceController.getServices);

router.get('/:id', serviceController.getServiceById);

export default router;
