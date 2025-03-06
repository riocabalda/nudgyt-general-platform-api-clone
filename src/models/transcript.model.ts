import mongoose, { Document, Schema } from 'mongoose';
import { SimulationType } from './simulation.model';

export const FROM_TO_TYPES = {
  USER: 'user',
  CHARACTER: 'character'
} as const;

export type TranscriptCommentTypeLean = {
  from?: mongoose.Types.ObjectId | null;
  from_type: string;
  text?: string | null;
};

export type TranscriptTypeLean = {
  from?: mongoose.Types.ObjectId | null;
  from_type: string;
  to?: mongoose.Types.ObjectId | null;
  to_type?: string;
  simulation: SimulationType | mongoose.Types.ObjectId;
  is_trial_data: boolean;
  dialogue_value: string;
  comments: TranscriptCommentTypeLean[];
};

export type TranscriptType = Document & TranscriptTypeLean;

export type TranscriptCommentType = Document &
  TranscriptCommentTypeLean;

const TranscriptCommentSchema = new Schema<TranscriptCommentType>(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'from_type'
    },
    from_type: {
      type: String,
      required: true,
      enum: ['user', 'character']
    },
    text: String
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

const TranscriptSchema = new Schema<TranscriptType>(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'from_type'
    },
    from_type: {
      type: String,
      required: true,
      enum: [FROM_TO_TYPES.CHARACTER, FROM_TO_TYPES.USER],
      default: FROM_TO_TYPES.USER
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'to_type',
      default: null
    },
    to_type: {
      type: String,
      required: true,
      enum: [FROM_TO_TYPES.CHARACTER, FROM_TO_TYPES.USER],
      default: FROM_TO_TYPES.CHARACTER
    },
    simulation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'simulation'
    },
    is_trial_data: { type: Boolean, default: false },
    dialogue_value: { type: String, required: true, trim: true },
    comments: [TranscriptCommentSchema]
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

const Transcript = mongoose.model('transcript', TranscriptSchema);

export default Transcript;
