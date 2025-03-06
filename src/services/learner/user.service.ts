import createHttpError from 'http-errors';
import organizationConfig from '../../config/organization.config';
import { encryptFieldData } from '../../helpers/db';
import { RequestAuth } from '../../middlewares/require-permissions';
import Organization from '../../models/organization.model';
import Subscription from '../../models/subscription.model';
import { UserType } from '../../models/user.model';
import { calculateLearnerExperience } from '../../utils/learner-experience';
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

  const isPaid = plan.name === 'Public';
  if (isPaid) {
    return {
      access: 'public',
      features_html: plan.features_html,
      price: plan.price,
      currency: plan.currency
    };
  }

  return {
    access: 'public-trial',
    features_html: plan.features_html
  };
}

const getLearnerExperience = async ({
  learner,
  orgSlug
}: {
  learner: string;
  orgSlug: string;
}) => {
  if (!orgSlug) {
    throw createHttpError.Conflict('Organization Slug is required');
  }
  const orgSlugHash = encryptFieldData(orgSlug);

  const organization = await Organization.findOne({
    'slug.hash': orgSlugHash.hash
  });

  if (!organization) {
    throw createHttpError.Conflict('Organization not found');
  }

  const learnerExperience = await calculateLearnerExperience({
    learner,
    organization: organization._id.toString()
  });

  const sampleData = {
    isFromLearner: true,
    ...learnerExperience
  };

  return sampleData;
};

export default {
  getAccess,
  getLearnerExperience
};
