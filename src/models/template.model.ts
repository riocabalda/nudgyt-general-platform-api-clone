import mongoose from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';
import { CharacterType } from './character.model';
import { EnvironmentType } from './environment.model';
import { OrganizationType } from './organization.model';
import { RubricType } from './rubric.model';
import './service-type.model';
import { ServiceItemType } from './service-type.model';
import { UserType } from './user.model';

export type TemplateType = {
  master_template_id: string | null;
  is_master_template: boolean;
  title: string | null;
  description: string | null;
  is_published: boolean;
  time_limit: number | null;
  current_step: number | null;
  creator: UserType;
  service_type: ServiceItemType | mongoose.Types.ObjectId;
  organization: OrganizationType | mongoose.Types.ObjectId;
  shared_to_organizations: string[] | null | undefined;
  characters: CharacterType[] | mongoose.Types.ObjectId[] | null;
  environment: EnvironmentType | mongoose.Types.ObjectId;
  deleted_at: Date | null;
  form_questions: any[];
  form_questions_file: string | null;
  rubrics: RubricType[] | mongoose.Types.ObjectId;
};

export const TemplateSchema = new mongoose.Schema<TemplateType>(
  {
    master_template_id: {
      type: String
    },
    is_master_template: {
      type: Boolean,
      default: false
    },
    title: {
      type: String
    },
    description: {
      type: String
    },
    is_published: {
      type: Boolean,
      default: false
    },
    time_limit: {
      type: Number,
      default: null
    },
    current_step: {
      type: Number,
      default: 1
    },
    creator: {
      type: mongoose.Types.ObjectId,
      ref: 'user'
    },
    service_type: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'service_type'
    },
    organization: {
      type: mongoose.Types.ObjectId,
      ref: 'organization',
      required: true
    },
    shared_to_organizations: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'organization' }
    ],
    characters: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'character',
        default: null
      }
    ],
    environment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'environment',
      default: null
    },
    form_questions: {
      type: [Object],
      default: []
    },
    form_questions_file: {
      type: String,
      default: null
    },
    rubrics: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'rubric',
      default: null
    },
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

mongoosePaginate.paginate.options = {
  customLabels
};

TemplateSchema.plugin(mongoosePaginate);

const Template = mongoose.model<
  TemplateType,
  mongoose.PaginateModel<TemplateType>
>('template', TemplateSchema);

export default Template;
