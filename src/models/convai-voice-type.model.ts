import mongoose, { Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';

export type ConvaiVoiceTypeType = Document & {
  name: string;
  voice_value: string;
  sample_link: string;
  gender: string;
  lang_codes: string[];
};

const ConvaiVoiceTypeSchema = new mongoose.Schema<ConvaiVoiceTypeType>(
  {
    name: { type: String },
    voice_value: { type: String },
    sample_link: { type: String },
    gender: { type: String },
    lang_codes: { type: [String] }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

mongoosePaginate.paginate.options = {
  customLabels
};

ConvaiVoiceTypeSchema.plugin(mongoosePaginate);

const ConvaiVoiceType = mongoose.model<
  ConvaiVoiceTypeType,
  mongoose.PaginateModel<ConvaiVoiceTypeType>
>('convai_voice_type', ConvaiVoiceTypeSchema);

export default ConvaiVoiceType;
