import mongoose, { Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';

export enum ServiceTypeEnum {
  BASIC = 'BASIC',
  MULTI_LEVEL = 'MULTI-LEVEL',
  CUSTOM = 'CUSTOM'
}

export type ServiceItemType = Document & {
  _id: string;
  name: string | null;
  type: ServiceTypeEnum;
  description: string | null;
};

const ServiceTypeSchema = new mongoose.Schema<ServiceItemType>(
  {
    name: String,
    type: {
      type: String,
      enum: ServiceTypeEnum,
      required: true
    },
    description: String
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

mongoosePaginate.paginate.options = {
  customLabels
};

ServiceTypeSchema.plugin(mongoosePaginate);

const ServiceType = mongoose.model<
  ServiceItemType,
  mongoose.PaginateModel<ServiceItemType>
>('service_type', ServiceTypeSchema);

export default ServiceType;
