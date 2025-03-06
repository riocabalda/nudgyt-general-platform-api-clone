// Initial Subscription Plan Service

import SubscriptionPlan, {
  SubscriptionPlanForEnum
} from '../../models/subscription-plan.model';

async function getBasicOrganizationPlan() {
  const basicOrgPlan = await SubscriptionPlan.findOne({
    name: 'Basic',
    subscription_plan_for: SubscriptionPlanForEnum.ORGANIZATION
  });

  return basicOrgPlan;
}

async function getPublicTrainerPlan() {
  const publicTrainerPlan = await SubscriptionPlan.findOne({
    name: 'Public',
    subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_TRAINER
  });

  return publicTrainerPlan;
}

async function getPublicLearnerTrialPlan() {
  const plan = await SubscriptionPlan.findOne({
    name: 'Public (Trial)',
    subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_LEARNER
  });

  return plan;
}

async function getPublicLearnerPaidPlan() {
  const plan = await SubscriptionPlan.findOne({
    name: 'Public',
    subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_LEARNER
  });

  return plan;
}

async function getSubscriptionPlanById(id: string) {
  const subscriptionPlan = await SubscriptionPlan.findById(id);

  return subscriptionPlan;
}

export default {
  getBasicOrganizationPlan,
  getPublicTrainerPlan,
  getPublicLearnerTrialPlan,
  getPublicLearnerPaidPlan,
  getSubscriptionPlanById
};
