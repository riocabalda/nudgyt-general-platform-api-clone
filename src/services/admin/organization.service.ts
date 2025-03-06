import createHttpError from 'http-errors';
import { OrganizationLogType } from '../../constants/logs';
import { UserRole } from '../../constants/roles';
import { decryptFieldData, encryptFieldData } from '../../helpers/db';
import { RequestAuth } from '../../middlewares/require-permissions';
import Organization from '../../models/organization.model';
import { SubscriptionPlanType } from '../../models/subscription-plan.model';
import { SubscriptionType } from '../../models/subscription.model';
import User, { UserType } from '../../models/user.model';
import logService from '../log.service';
import organizationService from '../organization.service';
import subscriptionService from './subscription.service';

async function getOrganizations() {
  const organizations = await Organization.find();

  return Promise.all(
    organizations.map((org) => decryptOrganization(org))
  );
}

async function decryptOrganization(organization: any) {
  if (!organization) return null;

  const decryptedOrg = {
    ...organization.toObject(),
    name: decryptFieldData(organization.name),
    slug: decryptFieldData(organization.slug),
    code: organization.code
  };

  return decryptedOrg;
}

async function addOrgExtraLearners(args: {
  orgSlug: string;
  extraLearners: number;
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const { orgSlug, extraLearners } = args;
  const { user, reqAuth } = args;

  const org = await organizationService.getOrganizationBySlug(orgSlug);

  if (!org) throw createHttpError.NotFound('Organization not found.');

  const subscriptionId = org.subscription as unknown as string;

  const updatedSubscription =
    await subscriptionService.addOrgExtraLearners(
      subscriptionId,
      extraLearners
    );

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      orgSlug,
      extraLearners
    }),
    type: OrganizationLogType.ADD_EXTRA_LEARNERS,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) added ${extraLearners} extra learner(s) to ${org.name}`
    )
  });

  return updatedSubscription;
}

async function getOrganizationMembersCount(
  orgSlug: string,
  orgMemberRoles?: UserRole[]
): Promise<number> {
  const org = await organizationService.getOrganizationBySlug(orgSlug);

  if (!org) throw createHttpError.NotFound('Organization not found.');

  const membersCount = await User.countDocuments({
    'organizations.organization': org._id,
    'organizations.roles': { $in: orgMemberRoles }
  });

  return membersCount;
}

async function getOrganizationLearnersLimit(orgSlug: string) {
  const org = await organizationService.getOrganizationBySlug(orgSlug, {
    includeSubscription: true
  });

  if (!org) throw createHttpError.NotFound('Organization not found.');

  const subscription =
    org.subscription as unknown as SubscriptionType & {
      subscription_plan: SubscriptionPlanType;
      extra_learners: number;
    };

  const planLearnerLimit =
    subscription.subscription_plan.max_learners || 0;

  const subscriptionExtraLearners = subscription.extra_learners || 0;

  const totalLimit = planLearnerLimit + subscriptionExtraLearners;

  return totalLimit;
}

export default {
  getOrganizations,
  decryptOrganization,
  addOrgExtraLearners,
  getOrganizationLearnersLimit,
  getOrganizationMembersCount
};
