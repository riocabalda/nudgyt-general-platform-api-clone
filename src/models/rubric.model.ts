import mongoose, { Document } from 'mongoose';

export type RubricType = Document & {
  rubric_items: {
    rubric: string;
    description: string;
    excelent: string;
    good: string;
    needs_improvement: string;
    serious_problem: string;
  }[];
  file: string | null;
};

const RubricSchema = new mongoose.Schema<RubricType>(
  {
    rubric_items: [
      {
        rubric: { type: String },
        description: { type: String },
        excelent: { type: String },
        good: { type: String },
        needs_improvement: { type: String },
        serious_problem: { type: String }
      }
    ],
    file: {
      type: String,
      default: null
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

const Rubric = mongoose.model<RubricType>('rubric', RubricSchema);

export default Rubric;
