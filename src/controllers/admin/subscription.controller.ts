import createHttpError from 'http-errors';
import asyncWrapper from '../../helpers/async-wrapper';
import { encryptFieldData } from '../../helpers/db';
import createResponse from '../../utils/create-response';

/** Minimal only; subject to further changes */
const getCurrentSubscription = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;

  const encryptedOrgSlug = encryptFieldData(org);

  const memberships = req.user.organizations ?? [];
  const orgMembership = memberships.find(
    (membership) =>
      membership.organization.slug.hash === encryptedOrgSlug.hash
  );

  /** Can only be accessed by organization owners */
  const isOrgOwner = orgMembership?.is_owner ?? false;
  if (!isOrgOwner) {
    throw createHttpError.Forbidden(
      'Can only be accessed by organization owners'
    );
  }

  const SubscriptionStatus = {
    ACTIVE: 'active'
  };

  /** Based on eventual Subscription model */
  const response = createResponse({
    data:
      Math.random() < 0.5
        ? null
        : {
            user: {},
            organization: {},
            plan: {},
            start_date: new Date(),
            end_date: new Date(),
            status: SubscriptionStatus.ACTIVE,
            canceled_at: new Date(),
            current_period_start: new Date(),
            current_period_end: new Date(),
            payment_reference: ''
          }
  });
  res.json(response);
});

export default {
  getCurrentSubscription
};
