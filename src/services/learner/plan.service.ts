import createHttpError from 'http-errors';
import SubscriptionPlan, {
  SubscriptionPlanForEnum
} from '../../models/subscription-plan.model';
import Subscription from '../../models/subscription.model';
import { UserType } from '../../models/user.model';

async function getPlans(args: { user: UserType }) {
  const { user } = args;

  const planDocs = await SubscriptionPlan.find({
    subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_LEARNER
  }).lean();

  const userSubscriptionId = user.subscription;
  const userSubscription = await Subscription.findById(
    userSubscriptionId
  )
    .populate('subscription_plan')
    .lean();
  if (userSubscription === null) {
    throw createHttpError.NotFound('User subscription not found');
  }

  const plan: any = userSubscription.subscription_plan;
  const userPlanId = String(plan._id);

  const plans = planDocs
    .map((doc) => {
      const featuresHtml = doc.features_html;
      const price = doc.price;
      const currency = doc.currency;

      const _id = String(doc._id);
      const isCurrent = _id === userPlanId;

      let type: string | undefined;
      if (doc.name === 'Public') {
        type = 'public';
      } else if (doc.name === 'Public (Trial)') {
        type = 'public-trial';
      }

      return {
        _id,
        type,
        features_html: featuresHtml,
        price,
        currency,
        is_current: isCurrent
      };
    })
    .sort(
      (a, b) => (a.is_current ? -1 : 1) // Move current plan to array start
    );

  return plans;
}

export default {
  getPlans
};
