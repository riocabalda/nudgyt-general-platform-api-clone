import { kebabCase } from 'lodash';
import invitationStatus from '../constants/invitation-status';
import { OrganizationPermissions } from '../constants/permissions';
import roles from '../constants/roles';
import { encryptFieldData } from '../helpers/db';
import Organization from '../models/organization.model';
import Subscription, {
  SubscriptionStatusEnum
} from '../models/subscription.model';
import User from '../models/user.model';
import subscriptionPlanService from '../services/admin/subscription-plan.service';
import encryptionService from '../services/encryption.service';
import organizationService from '../services/organization.service';

const today = new Date();

async function insertOrg(name: string, code: string) {
  const plan = await subscriptionPlanService.getBasicOrganizationPlan();
  if (plan === null) {
    throw new Error('Basic organization plan not found');
  }

  const subscription = new Subscription({
    subscription_plan: plan._id,
    status: SubscriptionStatusEnum.ACTIVE
  });
  await subscription.save();

  const org = new Organization({
    name: encryptFieldData(name),
    slug: encryptFieldData(kebabCase(name)),
    code,
    subscription: subscription._id,
    permissions: OrganizationPermissions as any
  });
  await org.save();

  return org;
}

async function insertOrg1() {
  const plan = await subscriptionPlanService.getBasicOrganizationPlan();
  if (plan === null) {
    throw new Error('Basic organization plan not found');
  }

  const org = await insertOrg('Org 1', '483623');

  const orgId = org._id;
  const users = [
    new User({
      full_name: encryptFieldData('Owner 1'),
      email: encryptFieldData('owner@org1.com'),
      password: await encryptionService.generateHash('Owner1-Org1'),
      is_guest: false,
      organizations: [
        {
          organization: orgId,
          roles: [roles.ADMIN],
          is_owner: true,
          status: invitationStatus.ACCEPTED,
          accepted_at: today,

          approved_at: today
        }
        // {
        //   organization: orgId,
        //   roles: [roles.ADMIN],
        //   status: invitationStatus.ACCEPTED,
        //   accepted_at: today
        // }
      ],
      archived_at: null,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('Org Learner'),
      email: encryptFieldData('learner@org1.com'),
      password: await encryptionService.generateHash('Learner1-Org1'),
      is_guest: false,
      organizations: [
        {
          organization: orgId,
          roles: [roles.LEARNER],
          status: invitationStatus.ACCEPTED,
          accepted_at: today,

          approved_at: today
        }
      ],
      archived_at: null,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('Org Admin'),
      email: encryptFieldData('admin@org1.com'),
      password: await encryptionService.generateHash('Admin1-Org1'),
      is_guest: false,
      organizations: [
        {
          organization: orgId,
          roles: [roles.ADMIN],
          status: invitationStatus.ACCEPTED,
          accepted_at: today,

          approved_at: today
        }
      ],
      archived_at: null,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('Org Trainer'),
      email: encryptFieldData('trainer@org1.com'),
      password: await encryptionService.generateHash('Trainer1-Org1'),
      is_guest: false,
      organizations: [
        {
          organization: orgId,
          roles: [roles.TRAINER],
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

async function insertOrg2() {
  const plan = await subscriptionPlanService.getBasicOrganizationPlan();
  if (plan === null) {
    throw new Error('Basic organization plan not found');
  }

  const org = await insertOrg('Org 2', 'AF816D');

  const orgId = org._id;
  const users = [
    new User({
      full_name: encryptFieldData('Owner 2'),
      email: encryptFieldData('owner@org2.com'),
      password: await encryptionService.generateHash('Owner1-Org2'),
      is_guest: false,
      organizations: [
        {
          organization: orgId,
          roles: [roles.ADMIN],
          is_owner: true,
          status: invitationStatus.ACCEPTED,
          accepted_at: today,

          approved_at: today
        }
      ],
      archived_at: null,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('Org Learner'),
      email: encryptFieldData('learner@org2.com'),
      password: await encryptionService.generateHash('Learner1-Org2'),
      is_guest: false,
      organizations: [
        {
          organization: orgId,
          roles: [roles.LEARNER],
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

async function insertOrg3() {
  const plan = await subscriptionPlanService.getBasicOrganizationPlan();
  if (plan === null) {
    throw new Error('Basic organization plan not found');
  }

  const org = await insertOrg('Org 3', '5380DD');

  const orgId = org._id;
  const users = [
    new User({
      full_name: encryptFieldData('Org Learner'),
      email: encryptFieldData('learner@org3.com'),
      password: await encryptionService.generateHash('Learner1-Org3'),
      is_guest: false,
      organizations: [
        {
          organization: orgId,
          roles: [roles.LEARNER],
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

async function insertOrg4() {
  const plan = await subscriptionPlanService.getBasicOrganizationPlan();
  if (plan === null) {
    throw new Error('Basic organization plan not found');
  }

  await insertOrg('Org 4', 'ECCBE6');

  // const orgId = org._id;
  // const users = [];

  // await Promise.all(users.map((user) => user.save()));
}

async function insertManyOrgs(ct = 32) {
  const promises = Array.from({ length: ct }, async (_, idx) => {
    const name = `Organization ${idx + 1}`;
    const code = await organizationService.randomOrganizationCode();

    await insertOrg(name, code);
  });

  await Promise.all(promises);
}

async function seedSampleOrganizations() {
  try {
    console.log('Seeding Sample Organizations...');

    await Promise.all([
      insertOrg1(),
      insertOrg2(),
      insertOrg3(),
      insertOrg4(),
      insertManyOrgs()
    ]);

    console.log('Sample Organizations seeded.');
  } catch (error) {
    throw new Error(`Error seeding Sample Organizations: ${error}`);
  }
}

export default seedSampleOrganizations;
