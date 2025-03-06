import asyncWrapper from '../../helpers/async-wrapper';
import planService from '../../services/learner/plan.service';
import createResponse from '../../utils/create-response';

const getPlans = asyncWrapper(async (req, res, next) => {
  const plans = await planService.getPlans({ user: req.user });

  const response = createResponse({
    data: plans
  });
  res.json(response);
});

export default {
  getPlans
};
