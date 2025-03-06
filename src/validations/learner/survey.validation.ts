import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

export enum Rating {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5
}

const SurveySchema = z.object({
  simulation: z.string(),
  confident: z.nativeEnum(Rating),
  useful: z.nativeEnum(Rating),
  easy: z.nativeEnum(Rating),
  comment: z.string().min(1, 'Comment is required')
});

const createSurvey = validateRequest({
  body: SurveySchema
});

const getSurveys = validateRequest({
  query: z.object({
    simulation_id: z.string().optional()
  })
});

export default {
  createSurvey,
  getSurveys
};
