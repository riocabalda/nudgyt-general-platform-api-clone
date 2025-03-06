import mongoose from 'mongoose';
import Simulation from '../../models/simulation.model';
import messages from '../../constants/response-messages';
import createHttpError from 'http-errors';
import Survey, { SurveyType } from '../../models/survey.model';

async function createSurvey(surveyData: SurveyType) {
  const { simulation: simulationId } = surveyData;

  const simulation = await Simulation.findById(simulationId);

  const survey = await Survey.findOne({ simulation: simulationId });

  if (survey)
    throw new createHttpError.BadRequest(
      messages.SURVEY_ALREADY_EXISTS
    );

  if (!simulation)
    throw new createHttpError.NotFound(messages.SIMULATION_NOT_FOUND);

  const newSurvey = Survey.create({
    ...surveyData,
    service: simulation.service,
    service_level: simulation.service_level,
    simulation: new mongoose.Types.ObjectId(simulation._id),
    creator: simulation.learner
  });

  return newSurvey;
}

async function getSurveys(simulation_id: string) {
  const surveys = await Survey.find({ simulation: simulation_id });
  if (!surveys)
    throw new createHttpError.NotFound(messages.SURVEY_NOT_FOUND);
  return surveys;
}

export default {
  createSurvey,
  getSurveys
};
