import express from 'express';
import avatarController from '../../controllers/trainer/avatar.controller';
import requirePermissions from '../../middlewares/require-permissions';
const router = express.Router({ mergeParams: true });

router.get(
  '/',
  requirePermissions(['Avatar.View']),
  avatarController.getAvatars
);
router.get(
  '/:id',
  requirePermissions(['Avatar.View']),
  avatarController.getAvatarById
);

export default router;
