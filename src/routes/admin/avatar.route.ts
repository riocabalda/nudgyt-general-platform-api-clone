import express from 'express';
import avatarController from '../../controllers/admin/avatar.controller';
import avatarValidation from '../../validations/admin/avatar.validation';
import uploader from '../../services/uploader.service';

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

router.get('/', avatarController.getAvatars);
router.get('/:id', avatarController.getAvatarById);

router.post(
  '/',
  avatarImageUploader.memory(),
  avatarValidation.createAvatar,
  avatarController.createAvatar
);
router.patch(
  '/:id',
  avatarImageUploader.memory(),
  avatarValidation.updateAvatar,
  avatarController.updateAvatar
);
router.delete(
  '/:id',
  avatarValidation.deleteAvatar,
  avatarController.deleteAvatar
);

export default router;
