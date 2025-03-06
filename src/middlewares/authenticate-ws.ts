import createHttpError from 'http-errors';
import { Socket } from 'socket.io';
import messages from '../constants/response-messages';
import encryptionService from '../services/encryption.service';
import userService from '../services/user.service';
import { AccessTokenSchema } from '../validations/auth.validation';

type Handshake = {
  auth: {
    accessToken?: string;
    payload: any;
  };
};

type SocketType = Socket & {
  handshake: Handshake;
  payload: any;
};

type NextFunction = (err?: Error) => void;

export const authenticateWs = async (
  socket: SocketType,
  next: NextFunction
) => {
  const { accessToken: bearerToken, payload: socketPayload } =
    socket.handshake.auth;
  const accessToken = bearerToken?.split(' ')[1];
  if (!accessToken)
    return next(new Error('Authentication error: No token.'));

  try {
    const { data: rawPayload } =
      encryptionService.verifyTokenSafely(accessToken);
    if (!rawPayload) throw createHttpError.Unauthorized();

    const { data: payload } = AccessTokenSchema.safeParse(rawPayload);
    if (!payload) throw createHttpError.Unauthorized();

    const user = await userService.getUserById(payload.userId);
    if (!user) throw createHttpError.Unauthorized();

    const defaultMembership =
      userService.getUserDefaultMembership(user);
    if (defaultMembership === null) {
      throw createHttpError.Unauthorized(
        'Your account has no access to this platform.'
      );
    }
    if (user.archived_at)
      throw createHttpError.Unauthorized(messages.EMAIL_NOT_FOUND);
    socket.payload = socketPayload;
    return next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token.'));
  }
};
