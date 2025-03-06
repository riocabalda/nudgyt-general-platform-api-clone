import mongoose from 'mongoose';
import Survey, { SurveyType } from '../models/survey.model';
import { SurveyAverageSchema } from '../validations/survey.validation';

async function getSurveyAverage(serviceId: string) {
  const aggregation = await Survey.aggregate([
    { $match: { service: new mongoose.Types.ObjectId(serviceId) } },
    {
      $group: {
        _id: null,
        useful: { $avg: '$useful' },
        easy: { $avg: '$easy' },
        confident: { $avg: '$confident' }
      }
    }
  ]);

  const { data: averageRating } = SurveyAverageSchema.safeParse(
    aggregation[0]
  );
  if (averageRating === undefined) {
    return null;
  }

  averageRating satisfies Pick<
    SurveyType,
    'useful' | 'easy' | 'confident'
  >;

  return averageRating;
}

export default {
  getSurveyAverage
};
