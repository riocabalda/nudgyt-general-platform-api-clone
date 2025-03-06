import mongoose, { HydratedDocumentFromSchema, Schema } from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';
import { PERMISSIONS } from '../constants/permissions';
import { USER_ROLES } from '../constants/roles';
import { ProtectedFieldSchema } from '../helpers/db';

export const OrganizationStatus = {
  Active: 'Active',
  Inactive: 'Inactive',
  Suspended: 'Suspended'
} as const;

export type OrganizationStatusType =
  (typeof OrganizationStatus)[keyof typeof OrganizationStatus];

export type OrganizationType = HydratedDocumentFromSchema<
  typeof OrganizationSchema
> & {
  _id: mongoose.Types.ObjectId;
  created_at: Date;
  updated_at: Date;
  suspended_at?: Date;
};

const RolePermissionSchema = new Schema({
  role: {
    type: String,
    enum: [...USER_ROLES, 'Owner'],
    required: true
  },
  permissions: [{ type: String, enum: PERMISSIONS, required: true }]
});

const OrganizationSchema = new Schema(
  {
    name: { type: ProtectedFieldSchema, required: true },
    slug: { type: ProtectedFieldSchema, required: true },
    logo: ProtectedFieldSchema,

    /** Remove from responses */
    code: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: Object.values(OrganizationStatus),
      default: OrganizationStatus.Active,
      required: true
    },
    suspended_at: { type: Date, default: null },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'subscription',
      default: null
    },
    permissions: [RolePermissionSchema]
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

// Set default pagination options
mongoosePaginate.paginate.options = {
  customLabels
};

// Add both pagination plugins
OrganizationSchema.plugin(mongoosePaginate);
OrganizationSchema.plugin(aggregatePaginate);

// Define the model type with both paginate and aggregatePaginate
type OrganizationModelType = mongoose.PaginateModel<OrganizationType> &
  mongoose.AggregatePaginateModel<OrganizationType>;

const Organization = mongoose.model<
  OrganizationType,
  OrganizationModelType
>('organization', OrganizationSchema);

export default Organization;
