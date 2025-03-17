import express from 'express';
import organizationController from '../../controllers/admin/organization.controller';
import requirePermissions from '../../middlewares/require-permissions';
import organizationValidation from '../../validations/admin/organization.validation';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  requirePermissions(['Organization.View']),
  organizationController.getOrganizations
);
router.get(
  '/enterprises',
  requirePermissions(['Organization.View']),
  organizationValidation.getEnterprises,
  organizationController.getEnterprises
);
router.get(
  '/public',
  requirePermissions(['Organization.View']),
  organizationController.getPublicOrganization
);
router.get(
  '/super-admin',
  organizationController.getOrganizationsForSuperAdmin
);

router.patch(
  '/:id',
  requirePermissions(['Organization.Update']),
  organizationValidation.updateOrganization,
  organizationController.updateOrganizationStatus
);
router.patch(
  '/enterprises/:id',
  requirePermissions(['Organization.Update']),
  organizationValidation.updateEnterprise,
  organizationController.updateEnterprise
);

router.post(
  '/bulk-update-status',
  requirePermissions(['Organization.Update']),
  organizationValidation.bulkUpdateOrganizations,
  organizationController.bulkUpdateOrganizationStatus
);
router.post(
  '/enterprises/bulk-update-status',
  requirePermissions(['Organization.Update']),
  organizationValidation.bulkUpdateEnterprises,
  organizationController.bulkUpdateEnterprises
);

router.get('/:orgSlug', organizationController.getOrganizationBySlug);
router.get(
  '/:orgSlug/learners-count',
  organizationController.getOrgLearnersCount
);
router.patch(
  '/:orgSlug/add-extra-learners',
  requirePermissions(['Organization.Update']),
  organizationValidation.addOrgExtraLearners,
  organizationController.addOrgExtraLearners
);

export default router;
