import express from 'express';
import avatarController from '../../controllers/admin/avatar.controller';
import avatarValidation from '../../validations/admin/avatar.validation';
import uploader from '../../services/uploader.service';
import requirePermissions from '../../middlewares/require-permissions';

const router = express.Router({ mergeParams: true });

const limits = 5 * 1024 * 1024;
const avatarImageUploader = uploader.createUploader({
  fileTypes: [
    {
      destination: 'public/images/avatars/',
      fieldName: 'image',
      allowedTypes: ['image/jpeg', 'image/png', 'image/jpg'],
      maxCount: 1
    }
  ],
  maxFileSize: limits
});

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

router.post(
  '/',
  avatarImageUploader.memory(),
  requirePermissions(['Avatar.Create']),
  avatarValidation.createAvatar,
  avatarController.createAvatar
);
router.patch(
  '/:id',
  avatarImageUploader.memory(),
  requirePermissions(['Avatar.Update']),
  avatarValidation.updateAvatar,
  avatarController.updateAvatar
);
router.delete(
  '/:id',
  requirePermissions(['Avatar.Delete']),
  avatarValidation.deleteAvatar,
  avatarController.deleteAvatar
);

export default router;
