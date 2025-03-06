import express from 'express';
import multer from 'multer';
import serviceController from '../../controllers/trainer/service.controller';
import requirePermissions from '../../middlewares/require-permissions';
import serviceValidation from '../../validations/trainer/service.validation';

const router = express.Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

router.get('/', serviceController.getServices);
router.get('/recent', serviceController.getRecentServices);
router.get('/stats', serviceController.getServicesStats);
router.get('/service-types', serviceController.getServiceTypes);
router.get('/metrics', serviceController.getServiceMetrics);
router.get('/popularity', serviceController.getPopularServices);
router.get('/:id', serviceController.getServiceById);
router.get(
  '/:id/learners-scores',
  serviceController.getServiceLearnersScores
);

router.post(
  '/',
  requirePermissions(['CREATE_SERVICES']),
  [
    upload.fields([
      { name: 'rubrics', maxCount: 1 },
      { name: 'form_questions', maxCount: 1 }
    ]),
    serviceValidation.createService
  ],
  serviceController.createServiceLevel
);

router.patch(
  '/:id',
  requirePermissions(['UPDATE_SERVICES']),
  [
    upload.fields([
      { name: 'rubrics', maxCount: 1 },
      { name: 'form_questions', maxCount: 1 }
    ]),
    serviceValidation.updateService
  ],
  serviceController.updateServiceLevel
);
router.patch(
  '/:id/publish',
  requirePermissions(['UPDATE_SERVICES']),
  serviceController.publishService
);
router.patch(
  '/:id/unpublish',
  requirePermissions(['UPDATE_SERVICES']),
  serviceController.unpublishService
);

router.patch(
  '/:id/delete',
  requirePermissions(['DELETE_SERVICES']),
  serviceController.deleteService
);

export default router;
