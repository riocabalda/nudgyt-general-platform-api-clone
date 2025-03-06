import express from 'express';
import environmentController from '../../controllers/admin/environment.controller';
import environmentValidation from '../../validations/admin/environment.validation';
import uploader from '../../services/uploader.service';

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

router.get('/', environmentController.getEnvironments);
router.get('/:id', environmentController.getEnvironmentById);
router.post(
  '/',
  environmentImageUploader.memory(),
  environmentValidation.createEnvironment,
  environmentController.createEnvironment
);

router.patch(
  '/:id',
  environmentImageUploader.memory(),
  environmentValidation.updateEnvironment,
  environmentController.updateEnvironment
);

router.delete('/:id', environmentController.deleteEnvironment);

export default router;
