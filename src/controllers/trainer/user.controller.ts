import { TypedRequestParams } from 'zod-express-middleware';
import asyncWrapper from '../../helpers/async-wrapper';
import trainerUserService from '../../services/trainer/user.service';
import createResponse from '../../utils/create-response';
import { GetAccessSchema } from '../../validations/trainer/user.validation';

const getAccess = asyncWrapper(
  async (
    req: TypedRequestParams<typeof GetAccessSchema>,
    res,
    next
  ) => {
    const result = await trainerUserService.getAccess({
      user: req.user,
      reqAuth: req.auth
    });

    const response = createResponse({
      data: result
    });
    res.json(response);
  }
);

export default {
  getAccess
};
