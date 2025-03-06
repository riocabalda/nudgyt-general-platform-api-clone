import mongoose, { Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';
import { AvatarType } from './avatar.model';
import { OrganizationType } from './organization.model';
import { UserType } from './user.model';

export type PersonalityType = {
  openess: string;
  meticulousness: string;
  extraversion: string;
  agreeableness: string;
  sensitivity: string;
};

export type CharacterType = Document & {
  avatar: AvatarType;
  name: string;
  age: string;
  voice_type: string;
  languages: string[];
  backstory: string;
  hidden_backstory: string;
  personality_id: string;
  personality: PersonalityType;
  organization: mongoose.Types.ObjectId | OrganizationType;
  creator: mongoose.Types.ObjectId | UserType;
  deleted_at: Date;
};

export const PersonalitySchema = new mongoose.Schema<PersonalityType>(
  {
    openess: { type: String },
    meticulousness: { type: String },
    extraversion: { type: String },
    agreeableness: { type: String },
    sensitivity: { type: String }
  },
  { id: false }
);

const CharacterSchema = new mongoose.Schema<CharacterType>(
  {
    avatar: {
      type: mongoose.Types.ObjectId,
      ref: 'avatar',
      required: true
    },
    name: { type: String, required: true },
    age: { type: String, required: true },
    voice_type: { type: String, required: true },
    languages: { type: [String] },
    backstory: { type: String, default: null },
    hidden_backstory: { type: String, default: null },
    organization: {
      type: mongoose.Types.ObjectId,
      ref: 'organization',
      required: true
    },
    personality_id: { type: String, required: true },
    personality: { type: PersonalitySchema },
    creator: {
      type: mongoose.Types.ObjectId,
      ref: 'user'
    },
    deleted_at: { type: Date, default: null }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

mongoosePaginate.paginate.options = {
  customLabels
};

CharacterSchema.plugin(mongoosePaginate);

const Character = mongoose.model<
  CharacterType,
  mongoose.PaginateModel<CharacterType>
>('character', CharacterSchema);

export default Character;
