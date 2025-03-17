import mongoose, { Document, Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';
import { UserType } from './user.model';
import { ServiceType } from './service.model';
import { ServiceLevelType } from './service-level.model';

type FormAnswersType = {
  section: string;
  question_no: string;
  answer: string;
};

export type UserFormAnswersType = {
  [key: string]: {
    [key: string]: string;
  };
};

type SimulationResultType = {
  sections_score: {
    section: string;
    score: number;
    correct: number;
    total: number;
  }[];
  overall_score: number;
  overall_correct: number;
  overall_total: number;
};

const FormAnswersSchema = new mongoose.Schema(
  {
    section: String,
    question_no: String,
    answer: String
  },
  {
    _id: false
  }
);

const SectionScoreSchema = new mongoose.Schema(
  {
    section: String,
    score: Number,
    correct: Number,
    total: Number
  },
  {
    _id: false
  }
);

const SimulationResultSchema = new mongoose.Schema(
  {
    sections_score: [SectionScoreSchema],
    overall_score: Number,
    overall_correct: Number,
    overall_total: Number
  },
  {
    _id: false
  }
);

export type SimulationTypeLean = {
  _id: string;
  learner: UserType | mongoose.Types.ObjectId;
  service: ServiceType | mongoose.Types.ObjectId;
  service_level: ServiceLevelType | mongoose.Types.ObjectId;
  form_answers: FormAnswersType[] | null;
  simulation_result: SimulationResultType;
  is_trial_data: boolean;
  started_at: Date | null;
  paused_at: Date[];
  resumed_at: Date[];
  ended_at: Date | null;
  cancelled_at: Date | null;
};
export type SimulationType = Document & SimulationTypeLean;

export const SimulationSchema = new Schema<SimulationType>(
  {
    learner: {
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
    form_answers: { type: [FormAnswersSchema], default: null },
    simulation_result: SimulationResultSchema,
    is_trial_data: { type: Boolean, default: false },
    started_at: { type: Date, default: null },
    paused_at: { type: [Date], default: [] },
    resumed_at: { type: [Date], default: [] },
    ended_at: { type: Date, default: null },
    cancelled_at: { type: Date, default: null }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);
mongoosePaginate.paginate.options = {
  customLabels
};
SimulationSchema.plugin(mongoosePaginate);
const Simulation = mongoose.model<
  SimulationType,
  mongoose.PaginateModel<SimulationType>
>('simulation', SimulationSchema);
export default Simulation;
