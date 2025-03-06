import createHttpError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import authConfig from '../config/auth.config';
import messages from '../constants/response-messages';
import asyncWrapper from '../helpers/async-wrapper';
import { UserType } from '../models/user.model';
import encryptionService from '../services/encryption.service';
import userService from '../services/user.service';
import createResponse from '../utils/create-response';
import getBearerToken from '../utils/get-bearer-token';
import { AccessTokenSchema } from '../validations/auth.validation';

/**
 * Recommended and convenient way of extending the request object for all handlers
 *
 * - https://stackoverflow.com/a/47448486
 * - https://github.com/DefinitelyTyped/DefinitelyTyped/blob/6e45579c18ddc43972e1ee0a1a906b8b7dccf1e6/types/express-serve-static-core/index.d.ts#L6-L15
 */
declare global {
  namespace Express {
    interface Request {
      user: UserType;
    }
  }
}

const authenticate = asyncWrapper(async (req, res, next) => {
  const canRequestProceedWithoutAuth =
    authConfig.authIgnorePaths.includes(req.originalUrl);
  if (canRequestProceedWithoutAuth) return next();

  const accessToken = getBearerToken(req);
  if (!accessToken) throw createHttpError.Unauthorized();

  const { data: rawPayload, error: rawPayloadError } =
    encryptionService.verifyTokenSafely(accessToken);
  if (rawPayloadError === 'token expired') {
    const response = createResponse({
      /** UI will use this "exactly" to differentiate from other Forbidden responses! */
      message: 'Access token is expired.'
    });
    res.status(StatusCodes.FORBIDDEN).json(response);

    return;
  }
  if (!rawPayload) throw createHttpError.Unauthorized();

  const { data: payload } = AccessTokenSchema.safeParse(rawPayload);
  if (!payload) throw createHttpError.Unauthorized();

  const user = await userService.getUserById(payload.userId);
  if (!user) throw createHttpError.Unauthorized();

  const defaultMembership = userService.getUserDefaultMembership(user);
  if (defaultMembership === null) {
    throw createHttpError.Unauthorized(
      'Your account has no access to this platform.'
    );
  }

  if (user.archived_at)
    throw createHttpError.Unauthorized(messages.EMAIL_NOT_FOUND);

  req.user = user;
  return next();
});

export default authenticate;
