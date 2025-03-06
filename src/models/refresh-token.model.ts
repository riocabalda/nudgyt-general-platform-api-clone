import mongoose, { Schema } from 'mongoose';

const NestedToken = new Schema({
  token: { type: String, required: true },

  /** Useful when deleting expired tokens from DB */
  expire_at: { type: Date, required: true }
});

const RefreshTokenSchema = new Schema(
  {
    user_id: { type: String, required: true },
    tokens: [NestedToken]
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

const RefreshToken = mongoose.model(
  'refresh_token',
  RefreshTokenSchema
);

export default RefreshToken;
