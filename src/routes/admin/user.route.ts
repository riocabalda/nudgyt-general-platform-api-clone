import express from 'express';
import userController from '../../controllers/admin/user.controller';
import requirePermissions from '../../middlewares/require-permissions';
import userValidation from '../../validations/admin/user.validation';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  requirePermissions(['User.View'], { allowPublicAdmins: true }),
  userController.getUsers
);
router.get('/stats', userController.getLearnerStats);
router.get(
  '/trainers',
  requirePermissions(['User.View'], { allowPublicAdmins: true }),
  userController.getTrainers
);
router.get(
  '/learners',
  requirePermissions(['User.View'], { allowPublicAdmins: true }),
  userController.getLearners
);
router.get(
  '/:userId',
  requirePermissions(['User.View'], { allowPublicAdmins: true }),
  userValidation.getUserById,
  userController.getUserById
);
router.get(
  '/:userId/recent-services',
  requirePermissions(['Service.View']),
  userValidation.getUserRecentServices,
  userController.getUserRecentServices
);
router.get(
  '/:userId/learner-experience',
  requirePermissions(['User.Experience.View']),
  userController.getLearnerExperience
);
router.patch(
  '/:userId/approve',
  requirePermissions(['User.Update'], { allowPublicAdmins: true }),
  userController.approveUser
);
router.patch(
  '/:userId/block',
  requirePermissions(['User.Update'], { allowPublicAdmins: true }),
  userController.blockUser
);
router.patch(
  '/:userId/unblock',
  requirePermissions(['User.Update'], { allowPublicAdmins: true }),
  userController.unblockUser
);
router.patch(
  '/:userId/archive',
  requirePermissions(['User.Update'], { allowPublicAdmins: true }),
  userValidation.archiveUser,
  userController.archiveUser
);
router.post(
  '/bulk-approve',
  requirePermissions(['User.Update'], { allowPublicAdmins: true }),
  userValidation.bulkApproveUsers,
  userController.bulkApproveUsers
);
router.post(
  '/bulk-block',
  requirePermissions(['User.Update'], { allowPublicAdmins: true }),
  userValidation.bulkBlockUsers,
  userController.bulkBlockUsers
);
router.post(
  '/bulk-unblock',
  requirePermissions(['User.Update'], { allowPublicAdmins: true }),
  userValidation.bulkUnblockUsers,
  userController.bulkUnblockUsers
);
router.post(
  '/bulk-archive',
  requirePermissions(['User.Update'], { allowPublicAdmins: true }),
  userValidation.bulkArchiveUsers,
  userController.bulkArchiveUsers
);

router.post(
  '/invite',
  requirePermissions(['Invitation.Create']),
  userValidation.inviteUser,
  userController.inviteUser
);
router.post(
  '/invite/owner/basic',
  requirePermissions(['Invitation.Create', 'Organization.Create']),
  userValidation.inviteOwnerBasic,
  userController.inviteOwnerBasic
);
router.post(
  '/invite/owner/enterprise',
  requirePermissions(['Invitation.Create', 'Organization.Create']),
  userValidation.inviteOwnerEnterprise,
  userController.inviteOwnerEnterprise
);

router.get(
  '/accounts/access',
  requirePermissions(['Account.View']),
  userValidation.getAccess,
  userController.getAccess
);

export default router;
