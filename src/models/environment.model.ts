import mongoose, { Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';

export type EnvironmentType = Document & {
  image: string;
  simulation_link: string;
  location: string;
  description: string;
  environment_id: string;
  available_characters: string[];
  maximum_characters: number;
};

const EnvironmentSchema = new mongoose.Schema<EnvironmentType>(
  {
    image: { type: String },
    simulation_link: { type: String },
    location: { type: String },
    description: { type: String },
    environment_id: { type: String },
    available_characters: { type: [String] },
    maximum_characters: { type: Number }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

mongoosePaginate.paginate.options = {
  customLabels
};

EnvironmentSchema.plugin(mongoosePaginate);

const Environment = mongoose.model<
  EnvironmentType,
  mongoose.PaginateModel<EnvironmentType>
>('environment', EnvironmentSchema);

export default Environment;
