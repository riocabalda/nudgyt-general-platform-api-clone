// Initial Subscription Model

import { Schema, model, Document } from 'mongoose';

export enum SubscriptionStatusEnum {
  INCOMPLETE = 'incomplete',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  UNPAID = 'unpaid'
}

export type SubscriptionType = Document & {
  stripe_data: Record<string, any> | null;
  subscription_plan: Schema.Types.ObjectId;
  extra_learners: number;
  created_at: Date;
  updated_at: Date;
};

const subscriptionSchema = new Schema(
  {
    subscription_plan: {
      type: Schema.Types.ObjectId,
      ref: 'subscription_plan',
      required: true
    },
    status: {
      type: String,
      enum: Object.values(SubscriptionStatusEnum),
      required: true,
      default: 'incomplete'
    },
    stripe_data: {
      type: Schema.Types.Mixed,
      default: null
    },
    // For organization plan
    extra_learners: {
      type: Number,
      default: undefined
    }
    //
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

const Subscription = model<SubscriptionType>(
  'subscription',
  subscriptionSchema
);

export default Subscription;
