import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

export enum Rating {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5
}

export const SurveyAverageSchema = z.object({
  confident: z.number(),
  useful: z.number(),
  easy: z.number()
});

export const GetSurveyAverageSchema = z.object({
  service_id: z.string()
});

const getSurveyAverage = validateRequest({
  query: GetSurveyAverageSchema
});

export default {
  getSurveyAverage
};
