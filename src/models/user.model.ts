import mongoose, {
  Document,
  HydratedDocumentFromSchema,
  Schema
} from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import mongoosePaginate from 'mongoose-paginate-v2';
import { INVITATION_STATUS } from '../constants/invitation-status';
import { customLabels } from '../constants/pagination-custom-labels';
import { USER_ROLES } from '../constants/roles';
import { ProtectedField, ProtectedFieldSchema } from '../helpers/db';
import { OrganizationType } from './organization.model';

export type PendingOrganization = HydratedDocumentFromSchema<
  typeof PendingOrganizationSchema
>;
export type OrganizationMembership = HydratedDocumentFromSchema<
  typeof OrganizationMembershipSchema
> & {
  created_at: Date;
  updated_at: Date;
};
export type OrganizationMembershipPopulated = Omit<
  OrganizationMembership,
  'organization'
> & {
  organization: OrganizationType;
};

export type UserType = Document & {
  _id: string;
  full_name: ProtectedField;
  email: ProtectedField;
  password: string;
  is_guest: boolean;
  is_super_admin?: boolean | null;
  verification_token: string | null;

  /**
   * Must specify `.populate('organizations.organization')`
   *
   * Remove organization code from populate result if sending as response!
   */
  organizations: OrganizationMembershipPopulated[] | null | undefined;
  pending_organizations: PendingOrganization[] | null | undefined;

  subscription: mongoose.Types.ObjectId | null;

  email_verified_at: Date | null;
  deleted_at: Date | null;
  archived_at: Date | null;
  last_logged_in_at: Date | null;
};

const PendingOrganizationSchema = new Schema(
  {
    /** Initial organization name, set by Super Admin */
    name: { type: ProtectedFieldSchema, required: true },

    status: { type: String, enum: INVITATION_STATUS, required: true },

    accepted_at: Date,
    pending_at: Date,
    declined_at: Date
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
export const OrganizationMembershipSchema = new Schema(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'organization',
      required: true
    },
    roles: [{ type: String, enum: USER_ROLES, required: true }],

    /** Default members as non-owners unless explicitly specified */
    is_owner: { type: Boolean, default: false },

    status: { type: String, enum: INVITATION_STATUS, required: true },

    /** Timestamps of user's own actions on invitations */
    accepted_at: Date,
    pending_at: Date,
    declined_at: Date,

    /** Timestamps of admin actions on user's membership */
    approved_at: Date,
    blocked_at: Date
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

const UserSchema = new Schema<UserType>(
  {
    full_name: { type: ProtectedFieldSchema, required: true },
    email: { type: ProtectedFieldSchema, required: true },
    password: { type: String },
    verification_token: { type: String, default: null },
    is_guest: { type: Boolean, default: false },
    is_super_admin: Boolean,
    organizations: [OrganizationMembershipSchema],
    pending_organizations: [PendingOrganizationSchema],
    subscription: {
      type: Schema.Types.ObjectId,
      ref: 'subscription',
      default: null
    },
    email_verified_at: { type: Date, default: null },
    deleted_at: { type: Date, default: null },
    archived_at: { type: Date, default: null },
    last_logged_in_at: { type: Date, default: null }
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);
mongoosePaginate.paginate.options = {
  customLabels
};

// Add both pagination plugins
UserSchema.plugin(mongoosePaginate);
UserSchema.plugin(aggregatePaginate);

// Define the model type with both paginate and aggregatePaginate
type UserModelType = mongoose.PaginateModel<UserType> &
  mongoose.AggregatePaginateModel<UserType>;

const User = mongoose.model<UserType, UserModelType>(
  'user',
  UserSchema
);

export default User;
