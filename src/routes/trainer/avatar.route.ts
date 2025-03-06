import express from 'express';
import avatarController from '../../controllers/trainer/avatar.controller';

const router = express.Router({ mergeParams: true });

router.get('/', avatarController.getAvatars);
router.get('/:id', avatarController.getAvatarById);

export default router;
