import mongoose, { HydratedDocumentFromSchema, Schema } from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';
import { ProtectedFieldSchema } from '../helpers/db';
import { OrganizationStatus } from './organization.model';

export type EnterpriseType = HydratedDocumentFromSchema<
  typeof EnterpriseSchema
>;

const EnterpriseSchema = new Schema(
  {
    monthly_amount: { type: Number, required: true },
    user_seats: { type: Number, required: true },
    organization_name: { type: ProtectedFieldSchema, required: true },
    email: { type: ProtectedFieldSchema, required: true },
    platform_url: { type: ProtectedFieldSchema, required: true },
    status: {
      type: String,
      enum: Object.values(OrganizationStatus),
      default: OrganizationStatus.Active,
      required: true
    },
    suspended_at: { type: Date, default: null }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Set default pagination options
mongoosePaginate.paginate.options = {
  customLabels
};

// Add both pagination plugins
EnterpriseSchema.plugin(mongoosePaginate);
EnterpriseSchema.plugin(aggregatePaginate);

// Define the model type with both paginate and aggregatePaginate
type EnterpriseModelType = mongoose.PaginateModel<EnterpriseType> &
  mongoose.AggregatePaginateModel<EnterpriseType>;

const Enterprise = mongoose.model<EnterpriseType, EnterpriseModelType>(
  'enterprise',
  EnterpriseSchema
);

export default Enterprise;
