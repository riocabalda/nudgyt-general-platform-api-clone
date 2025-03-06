// Initial Subscription Service

import createHttpError from 'http-errors';
import { ClientSession } from 'mongoose';
import roles from '../../constants/roles';
import Subscription, {
  SubscriptionStatusEnum
} from '../../models/subscription.model';
import { ZodObjectId } from '../../utils/zod';
import subscriptionPlanService from './subscription-plan.service';

async function createSubscription({
  session,
  user,
  organization,
  subscriptionPlan,
  status,
  stripeData,
  extraLearners
}: {
  session?: ClientSession;
  user?: string;
  organization?: string;
  subscriptionPlan: string;
  status: string;
  stripeData?: Record<string, any>;
  extraLearners?: number;
}) {
  const createdSubscription = new Subscription({
    user,
    organization,
    subscription_plan: subscriptionPlan,
    status,
    stripe_data: stripeData,
    extra_learners: extraLearners
  });
  await createdSubscription.save({ session });

  return createdSubscription;
}

async function createUserSubscription(args: {
  session?: ClientSession;
  role: string;
  isPublic?: boolean;
}) {
  const { session } = args;
  const { role, isPublic = false } = args;

  if (isPublic && role === roles.TRAINER) {
    const plan = await subscriptionPlanService.getPublicTrainerPlan();
    if (plan === null) {
      throw createHttpError.NotFound('Public Trainer plan not found');
    }

    const subscription = await createSubscription({
      session,
      subscriptionPlan: plan.id,
      status: SubscriptionStatusEnum.ACTIVE
    });

    const subscriptionId = ZodObjectId.parse(subscription._id);

    return subscriptionId;
  }

  if (isPublic && role === roles.LEARNER) {
    const plan =
      await subscriptionPlanService.getPublicLearnerTrialPlan();
    if (plan === null) {
      throw createHttpError.NotFound(
        'Public Learner Trial plan not found'
      );
    }

    const subscription = await createSubscription({
      session,
      subscriptionPlan: plan.id,
      status: SubscriptionStatusEnum.ACTIVE
    });

    const subscriptionId = ZodObjectId.parse(subscription._id);

    return subscriptionId;
  }

  return null;
}

async function addOrgExtraLearners(
  subscriptionId: string,
  extraLearners: number
) {
  const subscription = await Subscription.findById(subscriptionId);
  if (!subscription)
    throw createHttpError.NotFound('Subscription not found.');

  const currentExtraLearners = subscription.extra_learners ?? null;
  if (currentExtraLearners === null) {
    subscription.extra_learners = extraLearners;
  } else {
    subscription.extra_learners = currentExtraLearners + extraLearners;
  }

  await subscription.save();

  return subscription;
}

async function getSubscription(subscriptionId: string) {
  const subscription = await Subscription.findById(
    subscriptionId
  ).populate('subscription_plan');
  if (!subscription)
    throw createHttpError.NotFound('Subscription not found.');

  return subscription;
}

export default {
  createSubscription,
  createUserSubscription,
  addOrgExtraLearners,
  getSubscription
};
