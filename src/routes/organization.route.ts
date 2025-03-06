import express from 'express';
import organizationController from '../controllers/organization.controller';
import requirePermissions from '../middlewares/require-permissions';
import uploaderService from '../services/uploader.service';
import organizationValidation from '../validations/organization.validation';

const router = express.Router({ mergeParams: true });

const uploader = uploaderService.createUploader({
  fileTypes: [
    {
      destination: 'public/images/',
      fieldName: 'logo',
      allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
      maxCount: 1
    }
  ]
});

router.get(
  '/',
  requirePermissions(['VIEW_ORGANIZATIONS'], {
    allowPublicAdmins: true
  }),
  organizationController.getOrganization
);
router.patch(
  '/',
  requirePermissions(['UPDATE_ORGANIZATION_SETTINGS']),
  uploader.memory(),
  organizationValidation.updateOrganization,
  organizationController.updateOrganization
);

router.patch(
  '/invitations/:membershipId',
  requirePermissions(['UPDATE_INVITATIONS']),
  organizationValidation.updateInvitation,
  organizationController.updateInvitation
);

router.patch(
  '/invitations/owners/:pendingOrgId',
  requirePermissions(['UPDATE_INVITATIONS']),
  organizationValidation.updateOwnerInvitation,
  organizationController.updateOwnerInvitation
);

export default router;
