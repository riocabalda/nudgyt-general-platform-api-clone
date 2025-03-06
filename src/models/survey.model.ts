import mongoose, { Document, Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';
import { UserType } from './user.model';
import { ServiceType } from './service.model';
import { ServiceLevelType } from './service-level.model';
import { SimulationType } from './simulation.model';

enum Rating {
  ONE = 1,
  TWO = 2,
  THREE = 3,
  FOUR = 4,
  FIVE = 5
}

export type SurveyTypeLean = {
  creator: UserType | mongoose.Types.ObjectId;
  service: ServiceType | mongoose.Types.ObjectId;
  service_level: ServiceLevelType | mongoose.Types.ObjectId;
  simulation: SimulationType | mongoose.Types.ObjectId;
  useful: number;
  easy: number;
  confident: number;
  comment: string;
};

export type SurveyType = Document & SurveyTypeLean;

export const SurveySchema = new Schema<SurveyType>(
  {
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'service',
      required: true
    },
    service_level: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'service_level',
      required: true
    },
    simulation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'simulation',
      required: true
    },
    confident: {
      type: Number,
      enum: Rating,
      required: true
    },
    useful: {
      type: Number,
      enum: Rating,
      required: true
    },
    easy: { type: Number, enum: Rating, required: true },
    comment: { type: String, required: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

mongoosePaginate.paginate.options = {
  customLabels
};

SurveySchema.plugin(mongoosePaginate);

const Survey = mongoose.model<
  SurveyType,
  mongoose.PaginateModel<SurveyType>
>('survey', SurveySchema);

export default Survey;
