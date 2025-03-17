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
router.get('/recent', requirePermissions(['Dashboard.View']), serviceController.getRecentServices);
router.get('/stats', requirePermissions(['Dashboard.View']), serviceController.getServicesStats);
router.get('/service-types', serviceController.getServiceTypes);
router.get('/metrics', requirePermissions(['Dashboard.View']), serviceController.getServiceMetrics);
router.get('/popularity', requirePermissions(['Dashboard.View']), serviceController.getPopularServices);
router.get('/:id', serviceController.getServiceById);
router.get(
  '/:id/learners-scores',
  serviceController.getServiceLearnersScores
);

router.post(
  '/',
  requirePermissions(['Service.Create']),
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
  requirePermissions(['Service.Update']),
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
  requirePermissions(['Service.Update']),
  serviceController.publishService
);
router.patch(
  '/:id/unpublish',
  requirePermissions(['Service.Update']),
  serviceController.unpublishService
);

router.patch(
  '/:id/delete',
  requirePermissions(['Service.Delete']),
  serviceController.deleteService
);

export default router;
