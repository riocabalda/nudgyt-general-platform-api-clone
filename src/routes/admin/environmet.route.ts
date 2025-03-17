import express from 'express';
import environmentController from '../../controllers/admin/environment.controller';
import environmentValidation from '../../validations/admin/environment.validation';
import uploader from '../../services/uploader.service';
import requirePermissions from '../../middlewares/require-permissions';

const router = express.Router({ mergeParams: true });

const limits = 5 * 1024 * 1024;
const environmentImageUploader = uploader.createUploader({
  fileTypes: [
    {
      destination: 'public/images/environments/',
      fieldName: 'image',
      allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
      maxCount: 1
    }
  ],
  maxFileSize: limits
});

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
router.post(
  '/',
  environmentImageUploader.memory(),
  requirePermissions(['Environment.Create']),
  environmentValidation.createEnvironment,
  environmentController.createEnvironment
);

router.patch(
  '/:id',
  environmentImageUploader.memory(),
  requirePermissions(['Environment.Update']),
  environmentValidation.updateEnvironment,
  environmentController.updateEnvironment
);

router.delete(
  '/:id',
  requirePermissions(['Environment.Delete']),
  environmentController.deleteEnvironment
);

export default router;
