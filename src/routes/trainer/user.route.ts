import express from 'express';
import userController from '../../controllers/trainer/user.controller';
import requirePermissions from '../../middlewares/require-permissions';
import userValidation from '../../validations/trainer/user.validation';

const router = express.Router({ mergeParams: true });

router.get(
  '/accounts/access',
  requirePermissions(['VIEW_ACCOUNT']),
  userValidation.getAccess,
  userController.getAccess
);

export default router;
