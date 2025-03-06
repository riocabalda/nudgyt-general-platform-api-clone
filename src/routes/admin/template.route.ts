import express from 'express';
import multer from 'multer';
import templateController from '../../controllers/admin/template.controller';
import requirePermissions from '../../middlewares/require-permissions';
import templateValidation from '../../validations/admin/template.validation';

const router = express.Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  }
});

router.get('/', templateController.getTemplates);
router.get('/shared', templateController.getSharedTemplates);
router.get('/:id', templateController.getTemplateById);

router.post(
  '/',
  requirePermissions(['CREATE_TEMPLATES']),
  [
    upload.fields([
      { name: 'rubrics', maxCount: 1 },
      { name: 'form_questions', maxCount: 1 }
    ]),
    templateValidation.createTemplate
  ],
  templateController.createTemplate
);
router.post(
  '/:id/duplicate',
  requirePermissions(['CREATE_TEMPLATES']),
  templateController.duplicateTemplate
);

router.post(
  '/:id/share',
  requirePermissions(['UPDATE_TEMPLATES']),
  templateValidation.shareTemplate,
  templateController.shareTemplateToOrganizations
);
router.post(
  '/:id/publish',
  requirePermissions(['UPDATE_TEMPLATES']),
  templateController.publishTemplate
);
router.post(
  '/:id/unpublish',
  requirePermissions(['UPDATE_TEMPLATES']),
  templateController.unpublishTemplate
);
router.patch(
  '/:id',
  requirePermissions(['UPDATE_TEMPLATES']),
  [
    upload.fields([
      { name: 'rubrics', maxCount: 1 },
      { name: 'form_questions', maxCount: 1 }
    ]),
    templateValidation.editTemplate
  ],
  templateController.editTemplate
);

router.delete(
  '/:id',
  requirePermissions(['DELETE_TEMPLATES']),
  templateController.deleteTemplate
);

export default router;
