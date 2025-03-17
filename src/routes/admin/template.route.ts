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

router.get(
  '/',
  requirePermissions(['Template.View']),
  templateController.getTemplates
);
router.get(
  '/shared',
  requirePermissions(['Template.View']),
  templateController.getSharedTemplates
);
router.post(
  '/',
  requirePermissions(['Template.Create']),
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
  requirePermissions(['Template.Create']),
  templateController.duplicateTemplate
);

router.post(
  '/:id/share',
  requirePermissions(['Template.Update']),
  templateValidation.shareTemplate,
  templateController.shareTemplateToOrganizations
);
router.post(
  '/:id/publish',
  requirePermissions(['Template.Update']),
  templateController.publishTemplate
);
router.post(
  '/:id/unpublish',
  requirePermissions(['Template.Update']),
  templateController.unpublishTemplate
);
router.patch(
  '/:id',
  requirePermissions(['Template.Update']),
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
  requirePermissions(['Template.Delete']),
  templateController.deleteTemplate
);

export default router;
