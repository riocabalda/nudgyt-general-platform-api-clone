import express from 'express';
import surveyValidation from '../../validations/survey.validation';
import surveyController from '../../controllers/survey.controller';

const router = express.Router();

router.get(
  '/average',
  surveyValidation.getSurveyAverage,
  surveyController.getSurveyAverage
);

export default router;
