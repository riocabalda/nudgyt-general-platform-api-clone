import { TypedRequestQuery } from 'zod-express-middleware';
import { GetSurveyAverageSchema } from '../validations/survey.validation';
import asyncWrapper from '../helpers/async-wrapper';
import surveyService from '../services/survey.service';
import createResponse from '../utils/create-response';

const getSurveyAverage = asyncWrapper(
  async (
    req: TypedRequestQuery<typeof GetSurveyAverageSchema>,
    res,
    next
  ) => {
    const { service_id } = req.query;

    const surveyAverage = await surveyService.getSurveyAverage(
      service_id
    );

    const response = createResponse({
      data: surveyAverage
    });

    res.json(response);
  }
);

export default {
  getSurveyAverage
};
