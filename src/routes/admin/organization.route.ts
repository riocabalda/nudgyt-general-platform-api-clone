import express from 'express';
import organizationController from '../../controllers/admin/organization.controller';
import requirePermissions from '../../middlewares/require-permissions';
import organizationValidation from '../../validations/admin/organization.validation';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  requirePermissions(['VIEW_ORGANIZATIONS']),
  organizationController.getOrganizations
);
router.get(
  '/enterprises',
  requirePermissions(['VIEW_ORGANIZATIONS']),
  organizationValidation.getEnterprises,
  organizationController.getEnterprises
);
router.get(
  '/public',
  requirePermissions(['VIEW_ORGANIZATIONS']),
  organizationController.getPublicOrganization
);
router.get(
  '/super-admin',
  organizationController.getOrganizationsForSuperAdmin
);

router.patch(
  '/:id',
  requirePermissions(['UPDATE_ORGANIZATIONS']),
  organizationValidation.updateOrganization,
  organizationController.updateOrganizationStatus
);
router.patch(
  '/enterprises/:id',
  requirePermissions(['UPDATE_ORGANIZATIONS']),
  organizationValidation.updateEnterprise,
  organizationController.updateEnterprise
);

router.post(
  '/bulk-update-status',
  requirePermissions(['UPDATE_ORGANIZATIONS']),
  organizationValidation.bulkUpdateOrganizations,
  organizationController.bulkUpdateOrganizationStatus
);
router.post(
  '/enterprises/bulk-update-status',
  requirePermissions(['UPDATE_ORGANIZATIONS']),
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
  requirePermissions(['UPDATE_ORGANIZATIONS']),
  organizationValidation.addOrgExtraLearners,
  organizationController.addOrgExtraLearners
);

export default router;
