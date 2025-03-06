import asyncWrapper from '../../helpers/async-wrapper';
import surveyService from '../../services/learner/survey.service';
import createResponse from '../../utils/create-response';

const createSurvey = asyncWrapper(async (req, res, next) => {
  const surveyData = req.body;

  const newSurvey = await surveyService.createSurvey(surveyData);

  const response = createResponse({ data: newSurvey });
  res.json(response);
});

const getSurveys = asyncWrapper(async (req, res, next) => {
  const { simulation_id } = req.query;

  const simulationSurveys = await surveyService.getSurveys(
    String(simulation_id)
  );

  const response = createResponse({ data: simulationSurveys });
  res.json(response);
});

export default {
  createSurvey,
  getSurveys
};
