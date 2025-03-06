import createHttpError from 'http-errors';
import organizationConfig from '../../config/organization.config';
import { encryptFieldData } from '../../helpers/db';
import { RequestAuth } from '../../middlewares/require-permissions';
import Subscription from '../../models/subscription.model';
import { UserType } from '../../models/user.model';

async function getAccess(args: {
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const { user, reqAuth } = args;

  const encryptedPublicOrgName = encryptFieldData(
    organizationConfig.PUBLIC_ORGANIZATION_NAME
  );

  const isPublicMember =
    reqAuth.membership.organization.name.hash ===
    encryptedPublicOrgName.hash;
  if (!isPublicMember) {
    return {
      access: 'organization', // Might be better to respond with nothing at all
      features_html: []
    };
  }

  const subscriptionId = user.subscription;
  const subscription = await Subscription.findById(subscriptionId)
    .populate('subscription_plan')
    .lean();
  if (subscription === null) {
    throw createHttpError.NotFound('Subscription not found');
  }

  const plan: any = subscription.subscription_plan;

  return {
    access: 'public',
    features_html: plan.features_html
  };
}

export default {
  getAccess
};
