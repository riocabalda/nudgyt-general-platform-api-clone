import mongoose from 'mongoose';
import aggregatePaginate from 'mongoose-aggregate-paginate-v2';
import './service-level.model';
import { UserType } from './user.model';
import { ServiceItemType } from './service-type.model';
import { ServiceLevelType } from './service-level.model';
import { OrganizationType } from './organization.model';
// Ensure that the schema for the 'service_type' model is registered before referencing ServiceItemType in ServiceSchema.
import './service-type.model';
import './character.model';
import './environment.model';
import './service-level.model';
import { TemplateType } from './template.model';

export type ServiceType = {
  _id: string;
  cover_image: string | null;
  title: string | null;
  description: string | null;
  is_published: boolean;
  creator: UserType;
  service_type: ServiceItemType;
  template: TemplateType | mongoose.Types.ObjectId | null;
  basic_level: ServiceLevelType | mongoose.Types.ObjectId | null;
  multi_level: mongoose.Types.ObjectId[] | ServiceLevelType[] | null;
  organization: OrganizationType;
  deleted_at: Date | null;
};

const ServiceSchema = new mongoose.Schema<ServiceType>(
  {
    cover_image: {
      type: String,
      required: false
    },
    title: {
      type: String,
      required: false
    },
    description: {
      type: String,
      required: false
    },
    is_published: {
      type: Boolean,
      default: false
    },
    creator: {
      type: mongoose.Types.ObjectId,
      ref: 'user'
    },
    service_type: {
      type: mongoose.Types.ObjectId,
      ref: 'service_type'
    },
    organization: {
      type: mongoose.Types.ObjectId,
      ref: 'organization',
      required: true
    },
    template: {
      type: mongoose.Types.ObjectId,
      ref: 'template'
    },
    basic_level: {
      type: mongoose.Types.ObjectId,
      ref: 'service_level'
    },
    multi_level: [
      {
        type: mongoose.Types.ObjectId,
        ref: 'service_level'
      }
    ],
    deleted_at: {
      type: Date,
      default: null,
      required: false
    }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

// Apply the plugin
ServiceSchema.plugin(aggregatePaginate);

const Service = mongoose.model<
  ServiceType,
  mongoose.PaginateModel<ServiceType> &
    mongoose.AggregatePaginateModel<ServiceType>
>('service', ServiceSchema);

export default Service;
