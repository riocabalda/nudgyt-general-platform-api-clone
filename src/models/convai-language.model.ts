import mongoose, { Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';

export type ConvaiLanguageType = Document & {
  lang_code: string;
  lang_name: string;
};

const ConvaiLanguageSchema = new mongoose.Schema<ConvaiLanguageType>(
  {
    lang_code: { type: String },
    lang_name: { type: String }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

mongoosePaginate.paginate.options = {
  customLabels
};

ConvaiLanguageSchema.plugin(mongoosePaginate);

const ConvaiLanguage = mongoose.model<
  ConvaiLanguageType,
  mongoose.PaginateModel<ConvaiLanguageType>
>('convai_language', ConvaiLanguageSchema);

export default ConvaiLanguage;
