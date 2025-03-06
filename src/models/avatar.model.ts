import mongoose, { Document } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';

export type AvatarType = Document & {
  image_path: string;
  mesh_id: string;
  gender: string;
  deleted_at: Date;
};

const AvatarSchema = new mongoose.Schema<AvatarType>(
  {
    image_path: { type: String },
    mesh_id: { type: String },
    gender: { type: String },
    deleted_at: { type: Date, default: null }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

mongoosePaginate.paginate.options = {
  customLabels
};

AvatarSchema.plugin(mongoosePaginate);

const Avatar = mongoose.model<
  AvatarType,
  mongoose.PaginateModel<AvatarType>
>('avatar', AvatarSchema);

export default Avatar;
