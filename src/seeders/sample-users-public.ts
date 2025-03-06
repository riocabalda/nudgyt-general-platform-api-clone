import invitationStatus from '../constants/invitation-status';
import roles from '../constants/roles';
import { encryptFieldData } from '../helpers/db';
import Subscription, {
  SubscriptionStatusEnum
} from '../models/subscription.model';
import User from '../models/user.model';
import subscriptionPlanService from '../services/admin/subscription-plan.service';
import encryptionService from '../services/encryption.service';
import organizationService from '../services/organization.service';
import { ZodObjectId } from '../utils/zod';

const today = new Date();

async function insertPublicLearnerPaid() {
  const publicOrg = await organizationService.getPublicOrganization();

  const plan = await subscriptionPlanService.getPublicLearnerPaidPlan();
  if (plan === null) {
    throw new Error('Public Learner paid plan not found');
  }

  const subscription = new Subscription({
    subscription_plan: plan._id,
    status: SubscriptionStatusEnum.ACTIVE
  });
  await subscription.save();
  const subscriptionId = ZodObjectId.parse(subscription._id);

  const user = new User({
    full_name: encryptFieldData('John Doe'),
    email: encryptFieldData('paid.learner@public.com'),
    password: await encryptionService.generateHash('Learner1-Public'),
    is_guest: false,
    organizations: [
      {
        organization: publicOrg._id,
        roles: [roles.LEARNER],
        status: invitationStatus.ACCEPTED,
        accepted_at: today,

        approved_at: today
      }
    ],
    subscription: subscriptionId,
    archived_at: null,
    email_verified_at: today
  });

  await user.save();
}

async function insertPublicLearnerTrial() {
  const publicOrg = await organizationService.getPublicOrganization();

  const plan =
    await subscriptionPlanService.getPublicLearnerTrialPlan();
  if (plan === null) {
    throw new Error('Public Learner trial plan not found');
  }

  const subscription = new Subscription({
    subscription_plan: plan._id,
    status: SubscriptionStatusEnum.ACTIVE
  });
  await subscription.save();
  const subscriptionId = ZodObjectId.parse(subscription._id);

  const user = new User({
    full_name: encryptFieldData('John Doe'),
    email: encryptFieldData('trial.learner@public.com'),
    password: await encryptionService.generateHash('Learner1-Public'),
    is_guest: false,
    organizations: [
      {
        organization: publicOrg._id,
        roles: [roles.LEARNER],
        status: invitationStatus.ACCEPTED,
        accepted_at: today,

        approved_at: today
      }
    ],
    subscription: subscriptionId,
    archived_at: null,
    email_verified_at: today
  });

  await user.save();
}

async function insertPublicTrainer() {
  const publicOrg = await organizationService.getPublicOrganization();

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

  const user = new User({
    full_name: encryptFieldData('John Doe'),
    email: encryptFieldData('trainer@public.com'),
    password: await encryptionService.generateHash('Trainer1-Public'),
    is_guest: false,
    organizations: [
      {
        organization: publicOrg._id,
        roles: [roles.TRAINER],
        status: invitationStatus.ACCEPTED,
        accepted_at: today,

        approved_at: today
      }
    ],
    subscription: subscriptionId,
    archived_at: null,
    email_verified_at: today
  });

  await user.save();
}

async function insertPublicAdmins() {
  const publicOrg = await organizationService.getPublicOrganization();

  const users = [
    new User({
      full_name: encryptFieldData('John Doe'),
      email: encryptFieldData('superadmin@public.com'),
      password: await encryptionService.generateHash(
        'SuperAdmin1-Public'
      ),
      is_guest: false,
      is_super_admin: true,
      organizations: [
        {
          organization: publicOrg._id,
          roles: [roles.SUPER_ADMIN],
          status: invitationStatus.ACCEPTED,
          accepted_at: today,

          approved_at: today
        }
      ],
      archived_at: null,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('John Doe'),
      email: encryptFieldData('admin@public.com'),
      password: await encryptionService.generateHash('Admin1-Public'),
      is_guest: false,
      organizations: [
        {
          organization: publicOrg._id,
          roles: [roles.ADMIN],
          status: invitationStatus.ACCEPTED,
          accepted_at: today,

          approved_at: today
        }
      ],
      archived_at: null,
      email_verified_at: today
    })
  ];

  await Promise.all(users.map((user) => user.save()));
}

async function seedSampleUsersPublic() {
  try {
    console.log('Seeding Sample Public Users...');

    await Promise.all([
      insertPublicLearnerPaid(),
      insertPublicLearnerTrial(),
      insertPublicTrainer(),
      insertPublicAdmins()
    ]);

    console.log('Sample Public Users seeded.');
  } catch (error) {
    throw new Error(`Error seeding Sample Public Users: ${error}`);
  }
}

export default seedSampleUsersPublic;
