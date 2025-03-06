// Initial Subscription Plan Model

import { Document, Schema, model } from 'mongoose';

export enum SubscriptionPlanForEnum {
  PUBLIC_LEARNER = 'PUBLIC_LEARNER',
  PUBLIC_TRAINER = 'PUBLIC_TRAINER',
  ORGANIZATION = 'ORGANIZATION',
  ORGANIZATION_CUSTOM = 'ORGANIZATION_CUSTOM'
}

export const SubscriptionPlanCurrency = {
  USD: 'USD',
  SGD: 'SGD'
} as const;

export type SubscriptionPlanType = Document & {
  name: string;
  description: string;
  subscription_plan_for: SubscriptionPlanForEnum;
  price: number;
  currency: string;
  details: Record<string, any>;
  is_active: boolean;
  max_learners: number;
  extra_learner_price: number;

  features: string[];
  features_html: string[];

  created_at: Date;
  updated_at: Date;
};

const subscriptionPlanSchema = new Schema(
  {
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    subscription_plan_for: {
      type: String,
      enum: Object.values(SubscriptionPlanForEnum),
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      enum: Object.values(SubscriptionPlanCurrency),
      required: true
    },
    details: {
      type: Schema.Types.Mixed,
      required: true
    },
    is_active: {
      type: Boolean,
      default: true
    },

    // For organization plan
    max_learners: {
      type: Number,
      default: undefined
    },
    extra_learner_price: {
      type: Number,
      default: undefined
    },
    //

    features: { type: [String], required: true },
    features_html: { type: [String], required: true }
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

const SubscriptionPlan = model<SubscriptionPlanType>(
  'subscription_plan',
  subscriptionPlanSchema
);

export default SubscriptionPlan;
