import createHttpError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { TypedRequestBody } from 'zod-express-middleware';
import encryptionConfig from '../config/encryption.config';
import asyncWrapper from '../helpers/async-wrapper';
import authService from '../services/auth.service';
import userService from '../services/user.service';
import createResponse from '../utils/create-response';
import {
  ForgotPasswordSchema,
  LoginSchema,
  RegisterSchema,
  ResendEmailVerificationSchema,
  ResetPasswordSchema,
  UpdatePasswordSchema,
  UpdateUserDetailsSchema,
  VerifyEmailSchema
} from '../validations/auth.validation';

const register = asyncWrapper(
  async (req: TypedRequestBody<typeof RegisterSchema>, res) => {
    const userData = req.body;
    const { password, confirm_password, isTermsAndConditionsAccepted } =
      req.body;

    if (password !== confirm_password)
      throw createHttpError.BadRequest();

    if (!isTermsAndConditionsAccepted)
      throw createHttpError.BadRequest();

    await mongoose.connection.transaction(async (session) => {
      const registerResult = await authService.registerUser({
        session,
        data: userData
      });

      if (registerResult !== undefined) {
        /** Mirrors login response */
        const { user, accessToken, refreshToken } = registerResult;

        const response = createResponse({
          message: 'User registered successfully.',
          data: { user, token: accessToken }
        });

        res
          .cookie(
            encryptionConfig.refreshTokenCookieKey,
            refreshToken,
            {
              httpOnly: true,
              secure: true,
              sameSite: 'none',
              partitioned: true

              /** Might be able to use this to restrict where this cookie is sent */
              // path: '/api/auth/refresh',
            }
          )
          .status(StatusCodes.CREATED)
          .json(response);
      } else {
        const response = createResponse({
          message: 'User registered successfully.'
        });

        res.status(StatusCodes.CREATED).json(response);
      }
    });
  }
);

const login = asyncWrapper(
  async (req: TypedRequestBody<typeof LoginSchema>, res) => {
    const { email, password } = req.body;

    const { user, accessToken, refreshToken } =
      await authService.loginUser(email, password);

    const response = createResponse({
      message: 'User logged in successfully.',
      data: { user, token: accessToken }
    });

    res
      .cookie(encryptionConfig.refreshTokenCookieKey, refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        partitioned: true

        /** Might be able to use this to restrict where this cookie is sent */
        // path: '/api/auth/refresh',
      })
      .json(response);
  }
);

const refreshAccessToken = asyncWrapper(async (req, res, next) => {
  const refreshToken: string | undefined =
    req.cookies?.[encryptionConfig.refreshTokenCookieKey];
  if (!refreshToken) throw createHttpError.Unauthorized();

  const { newAccessToken, newRefreshToken } =
    await authService.refreshAccessToken(refreshToken);

  const response = createResponse({
    message: 'Access token refreshed successfully.',
    data: { token: newAccessToken }
  });

  res
    .cookie(encryptionConfig.refreshTokenCookieKey, newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true

      /** Might be able to use this to restrict where this cookie is sent */
      // path: '/api/auth/refresh',
    })
    .json(response);
});

const updateUserDetails = asyncWrapper(
  async (
    req: TypedRequestBody<typeof UpdateUserDetailsSchema>,
    res
  ) => {
    const { full_name } = req.body;
    const userId = req.user.id;

    await authService.updateUserDetails(userId, {
      full_name
    });

    const response = createResponse({
      message: 'Profile updated successfully.'
    });

    res.json(response);
  }
);

const me = asyncWrapper(async (req, res) => {
  const { user } = req;

  const sanitizedUser = userService.sanitizeUser(user);

  const response = createResponse({
    data: sanitizedUser
  });

  res.json(response);
});

const verifyEmail = asyncWrapper(
  async (req: TypedRequestBody<typeof VerifyEmailSchema>, res) => {
    const { verification_token } = req.body;

    await authService.verifyUserEmail(verification_token);

    const response = createResponse({
      message: 'Email verification successful.'
    });

    res.json(response);
  }
);

const resendEmailVerification = asyncWrapper(
  async (
    req: TypedRequestBody<typeof ResendEmailVerificationSchema>,
    res
  ) => {
    const { email } = req.body;

    await authService.resendEmailVerification(email);

    const response = createResponse({
      message: 'Email verification sent successfully.'
    });

    res.json(response);
  }
);

const forgotPassword = asyncWrapper(
  async (req: TypedRequestBody<typeof ForgotPasswordSchema>, res) => {
    const { email } = req.body;

    await authService.forgotPassword(email);

    const response = createResponse({
      message: 'Password reset link sent successfully.'
    });

    res.json(response);
  }
);

const resetPassword = asyncWrapper(
  async (req: TypedRequestBody<typeof ResetPasswordSchema>, res) => {
    const { token, password, confirm_password } = req.body;

    if (password !== confirm_password)
      throw createHttpError.BadRequest();

    await authService.resetPassword(token, password);

    const response = createResponse({
      message: 'Password reset successful.'
    });

    res.json(response);
  }
);

const updatePassword = asyncWrapper(
  async (req: TypedRequestBody<typeof UpdatePasswordSchema>, res) => {
    const { current_password, password, confirm_password } = req.body;

    if (password !== confirm_password)
      throw createHttpError.BadRequest();

    await authService.updatePassword(
      req.user,
      password,
      current_password
    );

    const response = createResponse({
      message: 'Password changed successfully.'
    });

    res.json(response);
  }
);

export default {
  register,
  login,
  refreshAccessToken,
  updateUserDetails,
  me,
  verifyEmail,
  resendEmailVerification,
  forgotPassword,
  resetPassword,
  updatePassword
};
