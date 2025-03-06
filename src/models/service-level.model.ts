import mongoose, { Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';
import { CharacterType } from './character.model';
import { EnvironmentType } from './environment.model';
import { RubricType } from './rubric.model';
import { UserType } from './user.model';

export type ServiceLevelType = Document & {
  title: string | null;
  description: string | null;
  current_step: number | null;
  last_attempt: Date | null;
  time_limit: number | null;
  creator: UserType;
  characters: CharacterType[] | mongoose.Types.ObjectId[];
  environment: EnvironmentType | mongoose.Types.ObjectId;
  form_questions: any[];
  form_questions_file: string | null;
  rubrics: RubricType[] | mongoose.Types.ObjectId;
};

export const ServiceLevelSchema = new mongoose.Schema<ServiceLevelType>(
  {
    title: {
      type: String
    },
    description: {
      type: String
    },
    current_step: {
      type: Number,
      default: 1
    },
    last_attempt: {
      type: Date,
      default: null
    },
    time_limit: {
      type: Number,
      default: null
    },
    creator: {
      type: mongoose.Types.ObjectId,
      ref: 'user'
    },
    characters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'character'
      }
    ],
    environment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'environment'
    },
    form_questions: {
      type: [Object],
      default: []
    },
    form_questions_file: {
      type: String,
      default: null
    },
    rubrics: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'rubric'
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

mongoosePaginate.paginate.options = {
  customLabels
};

ServiceLevelSchema.plugin(mongoosePaginate);

const ServiceLevel = mongoose.model<
  ServiceLevelType,
  mongoose.PaginateModel<ServiceLevelType>
>('service_level', ServiceLevelSchema);

export default ServiceLevel;
