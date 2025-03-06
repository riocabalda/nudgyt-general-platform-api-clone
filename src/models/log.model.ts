import mongoose, { Schema } from 'mongoose';
import mongoosePaginate from 'mongoose-paginate-v2';
import { customLabels } from '../constants/pagination-custom-labels';
import { ProtectedField, ProtectedFieldSchema } from '../helpers/db';

type LogType = {
  payload_snapshot: object;
  type: string;
  activity?: ProtectedField;
  organization: mongoose.Types.ObjectId | null;
};

const LogSchema = new Schema<LogType>(
  {
    organization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'organization',
      required: true
    },
    payload_snapshot: { type: Object, required: true },
    type: { type: String, required: true, trim: true },
    activity: ProtectedFieldSchema
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

mongoosePaginate.paginate.options = {
  customLabels
};

LogSchema.plugin(mongoosePaginate);

const Log = mongoose.model<LogType, mongoose.PaginateModel<LogType>>(
  'log',
  LogSchema
);

/** https://mongoosejs.com/docs/typescript/virtuals.html */
type LogDocument = ReturnType<(typeof Log)['hydrate']>;

export type { LogDocument, LogType };
export default Log;
