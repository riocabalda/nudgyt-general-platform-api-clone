import roles from '../../src/constants/roles';
import invitationStatus from '../constants/invitation-status';
import { encryptFieldData } from '../helpers/db';
import Subscription, {
  SubscriptionStatusEnum
} from '../models/subscription.model';
import User, {
  OrganizationMembership,
  UserType
} from '../models/user.model';
import subscriptionPlanService from '../services/admin/subscription-plan.service';
import encryptionService from '../services/encryption.service';
import organizationService from '../services/organization.service';
import { ZodObjectId } from '../utils/zod';

const today = new Date();

async function createUserSubscription(role: string) {
  if (role === roles.TRAINER) {
    const plan = await subscriptionPlanService.getPublicTrainerPlan();
    if (plan === null) {
      throw new Error('Public Trainer plan not found');
    }

    const subscription = new Subscription({
      subscription_plan: plan._id,
      status: SubscriptionStatusEnum.ACTIVE
    });
    await subscription.save();

    const subscriptionId = ZodObjectId.parse(subscription._id);

    return subscriptionId;
  }

  return null;
}

function* generateUserTypeAndStatus() {
  const statuses = [
    'Archived',
    'Blocked',
    'Approved',
    'Verified',
    'Unverified'
  ] as const;

  const userRoles = [
    roles.ADMIN,
    roles.TRAINER,
    roles.LEARNER
  ] as const;

  for (const role of userRoles) {
    for (const status of statuses) {
      yield { role, status };
    }
  }
}

/**
 * Adds users of different statuses
 *
 * Example details for an approved learner:
 * - Full Name: Approved Learner
 * - Email:     approved.learner@user.com
 * - Password:  Approved1-Learner
 */
async function insertUsersOfDifferentStatuses() {
  const publicOrg = await organizationService.getPublicOrganization();

  const promises = Array.from(
    generateUserTypeAndStatus(),
    async ({ role, status }) => {
      const full_name = `${status} ${role}`;
      const email = `${status}.${role}@user.com`.toLowerCase();
      const password = `${status}1-${role}`;

      const encryptedFullName = encryptFieldData(full_name);
      const encryptedEmail = encryptFieldData(email);

      const publicMembership: Partial<OrganizationMembership> = {
        organization: publicOrg._id,
        roles: [role],
        status: invitationStatus.ACCEPTED,
        accepted_at: today
      };
      const newUser: Partial<UserType> = {
        full_name: encryptedFullName,
        email: encryptedEmail,
        password: await encryptionService.generateHash(password),
        is_guest: false,

        organizations: [publicMembership as any],

        subscription: await createUserSubscription(role)

        // archived_at: Date | null,
        // email_verified_at: today

        // deleted_at: Date | null,

        // last_logged_in_at: Date | null,
        // verification_token: string | null,
      };

      if (status === 'Archived') {
        newUser.archived_at = today; // archived|blocked mutually exclusive?
        newUser.email_verified_at = today; // should not matter

        publicMembership.approved_at = today; // should not matter
      }
      if (status === 'Blocked') {
        newUser.archived_at = null;
        newUser.email_verified_at = today; // should not matter

        publicMembership.approved_at = today; // should not matter
        publicMembership.blocked_at = today;
      }
      if (status === 'Approved') {
        newUser.archived_at = null;
        newUser.email_verified_at = today;

        publicMembership.approved_at = today;
      }
      if (status === 'Verified') {
        newUser.archived_at = null;
        newUser.email_verified_at = today;
      }
      if (status === 'Unverified') {
        newUser.archived_at = null;
        newUser.email_verified_at = null;
      }

      await User.findOneAndUpdate(
        { 'full_name.hash': encryptedFullName.hash },
        newUser,
        { upsert: true }
      );
    }
  );

  await Promise.all(promises);
}

async function seedSampleUsers() {
  try {
    console.log('Seeding Sample Users...');

    await Promise.all([insertUsersOfDifferentStatuses()]);

    console.log('Sample Users seeded.');
  } catch (error) {
    throw new Error(`Error seeding Sample Users: ${error}`);
  }
}

export default seedSampleUsers;
