import express from 'express';
import userController from '../../controllers/admin/user.controller';
import requirePermissions from '../../middlewares/require-permissions';
import userValidation from '../../validations/admin/user.validation';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  requirePermissions(['VIEW_USERS'], { allowPublicAdmins: true }),
  userController.getUsers
);
router.get('/stats', userController.getLearnerStats);
router.get(
  '/trainers',
  requirePermissions(['VIEW_USERS'], { allowPublicAdmins: true }),
  userController.getTrainers
);
router.get(
  '/learners',
  requirePermissions(['VIEW_USERS'], { allowPublicAdmins: true }),
  userController.getLearners
);
router.get(
  '/:userId',
  requirePermissions(['VIEW_USERS'], { allowPublicAdmins: true }),
  userValidation.getUserById,
  userController.getUserById
);
router.get(
  '/:userId/recent-services',
  userValidation.getUserRecentServices,
  userController.getUserRecentServices
);
router.get(
  '/:userId/learner-experience',
  userController.getLearnerExperience
);
router.patch(
  '/:userId/approve',
  requirePermissions(['UPDATE_USERS'], { allowPublicAdmins: true }),
  userController.approveUser
);
router.patch(
  '/:userId/block',
  requirePermissions(['UPDATE_USERS'], { allowPublicAdmins: true }),
  userController.blockUser
);
router.patch(
  '/:userId/unblock',
  requirePermissions(['UPDATE_USERS'], { allowPublicAdmins: true }),
  userController.unblockUser
);
router.patch(
  '/:userId/archive',
  requirePermissions(['UPDATE_USERS'], { allowPublicAdmins: true }),
  userValidation.archiveUser,
  userController.archiveUser
);
router.post(
  '/bulk-approve',
  requirePermissions(['UPDATE_USERS'], { allowPublicAdmins: true }),
  userValidation.bulkApproveUsers,
  userController.bulkApproveUsers
);
router.post(
  '/bulk-block',
  requirePermissions(['UPDATE_USERS'], { allowPublicAdmins: true }),
  userValidation.bulkBlockUsers,
  userController.bulkBlockUsers
);
router.post(
  '/bulk-unblock',
  requirePermissions(['UPDATE_USERS'], { allowPublicAdmins: true }),
  userValidation.bulkUnblockUsers,
  userController.bulkUnblockUsers
);
router.post(
  '/bulk-archive',
  requirePermissions(['UPDATE_USERS'], { allowPublicAdmins: true }),
  userValidation.bulkArchiveUsers,
  userController.bulkArchiveUsers
);

router.post(
  '/invite',
  requirePermissions(['CREATE_INVITATIONS']),
  userValidation.inviteUser,
  userController.inviteUser
);
router.post(
  '/invite/owner/basic',
  requirePermissions(['CREATE_INVITATIONS', 'CREATE_ORGANIZATIONS']),
  userValidation.inviteOwnerBasic,
  userController.inviteOwnerBasic
);
router.post(
  '/invite/owner/enterprise',
  requirePermissions(['CREATE_INVITATIONS', 'CREATE_ORGANIZATIONS']),
  userValidation.inviteOwnerEnterprise,
  userController.inviteOwnerEnterprise
);

router.get(
  '/accounts/access',
  requirePermissions(['VIEW_ACCOUNT']),
  userValidation.getAccess,
  userController.getAccess
);

export default router;
