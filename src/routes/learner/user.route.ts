import express from 'express';
import userController from '../../controllers/learner/user.controller';
import requirePermissions from '../../middlewares/require-permissions';
import userValidation from '../../validations/learner/user.validation';

const router = express.Router({ mergeParams: true });

router.get(
  '/experience',
  requirePermissions(['User.Experience.View']),
  userController.getLearnerExperience
);

router.get(
  '/accounts/access',
  requirePermissions(['Account.View']),
  userValidation.getAccess,
  userController.getAccess
);

export default router;
