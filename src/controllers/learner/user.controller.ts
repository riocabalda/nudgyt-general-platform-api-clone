import { TypedRequestParams } from 'zod-express-middleware';
import asyncWrapper from '../../helpers/async-wrapper';
import learnerUserService from '../../services/learner/user.service';
import createResponse from '../../utils/create-response';
import { GetAccessSchema } from '../../validations/learner/user.validation';

const getAccess = asyncWrapper(
  async (
    req: TypedRequestParams<typeof GetAccessSchema>,
    res,
    next
  ) => {
    const result = await learnerUserService.getAccess({
      user: req.user,
      reqAuth: req.auth
    });

    const response = createResponse({
      data: result
    });
    res.json(response);
  }
);

const getLearnerExperience = asyncWrapper(async (req, res) => {
  const { org } = req.params;
  const { user } = req;
  const experience = await learnerUserService.getLearnerExperience({
    orgSlug: org,
    learner: user.id
  });
  const response = createResponse({
    data: experience
  });
  res.json(response);
});

export default {
  getAccess,
  getLearnerExperience
};
