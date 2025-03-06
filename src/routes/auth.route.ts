import express from 'express';
import authController from '../controllers/auth.controller';
import authValidation from '../validations/auth.validation';

const authRouter = express.Router();

authRouter.post(
  '/register',
  authValidation.register,
  authController.register
);
authRouter.post('/login', authValidation.login, authController.login);
authRouter.get('/refresh', authController.refreshAccessToken);
authRouter.post(
  '/forgot-password',
  authValidation.forgotPassword,
  authController.forgotPassword
);
authRouter.patch(
  '/settings/personal-details',
  authValidation.updateUserDetails,
  authController.updateUserDetails
);
authRouter.patch(
  '/reset-password',
  authValidation.resetPassword,
  authController.resetPassword
);
authRouter.patch(
  '/update-password',
  authValidation.updatePassword,
  authController.updatePassword
);
authRouter.get('/me', authController.me);
authRouter.post(
  '/verify-email',
  authValidation.verifyEmail,
  authController.verifyEmail
);
authRouter.post(
  '/resend-email-verification',
  authValidation.resendEmailVerification,
  authController.resendEmailVerification
);

export default authRouter;
