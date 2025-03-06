import express from 'express';
import surveyValidation from '../../validations/learner/survey.validation';
import surveyController from '../../controllers/learner/survey.controller';

const router = express.Router();

router.get(
  '/',
  surveyValidation.getSurveys,
  surveyController.getSurveys
);

router.post(
  '/',
  surveyValidation.createSurvey,
  surveyController.createSurvey
);

export default router;
