import express from 'express';
import serviceController from '../../controllers/learner/service.controller';

const router = express.Router({ mergeParams: true });

router.get(
  '/most-popular',
  serviceController.getMostPopularServices
);
router.get('/', serviceController.getServices);

router.get('/:id', serviceController.getServiceById);

export default router;
