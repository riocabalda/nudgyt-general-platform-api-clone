import { kebabCase } from 'lodash';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import htmlParser from 'node-html-parser';
import organizationConfig from '../../src/config/organization.config';
import invitationStatus from '../../src/constants/invitation-status';
import roles from '../../src/constants/roles';
import connectDb, { encryptFieldData } from '../../src/helpers/db';
import Organization from '../../src/models/organization.model';
import SubscriptionPlan, {
  SubscriptionPlanForEnum
} from '../../src/models/subscription-plan.model';
import Subscription, {
  SubscriptionStatusEnum
} from '../../src/models/subscription.model';
import User, {
  OrganizationMembership,
  UserType
} from '../../src/models/user.model';
import encryptionService from '../../src/services/encryption.service';
import { ZodObjectId } from '../../src/utils/zod';

const today = new Date();

export const ID = {
  NonExistentOrg: '000000000000000000000000',
  PublicOrg: '675694bbe4e58559dfe8cefa',
  'Org 1': '6752c088a68f303bdd495485',
  'Org 2': '6752c088a68f303bdd495486',
  'Org 3': '6752c088a68f303bdd495487',
  'Org 4': '6752c088a68f303bdd495488',
  BasicPlan: '6752c088a68f303bdd495490',
  PublicTrainerPlan: '6752c088a68f303bdd495491'
};

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

async function createUserSubscription(role: string) {
  if (role === roles.TRAINER) {
    const subscription = new Subscription({
      subscription_plan: ID.PublicTrainerPlan,
      status: SubscriptionStatusEnum.ACTIVE
    });
    await subscription.save();

    const subscriptionId = ZodObjectId.parse(subscription._id);

    return subscriptionId;
  }

  return null;
}

/**
 * Adds users of different statuses
 *
 * Example details for an approved learner:
 * - Full Name: Approved Learner
 * - Email:     approved.learner@user.com
 * - Password:  Approved1-Learner
 */
async function seedPublicOrganization() {
  await Organization.insertMany([
    {
      _id: ID.PublicOrg,
      name: encryptFieldData(
        organizationConfig.PUBLIC_ORGANIZATION_NAME
      ),
      slug: encryptFieldData(
        kebabCase(organizationConfig.PUBLIC_ORGANIZATION_NAME)
      ),
      code: 'D5B59D'
    }
  ]);

  const statusPromises = Array.from(
    generateUserTypeAndStatus(),
    async ({ role, status }) => {
      const full_name = `${status} ${role}`;
      const email = `${status}.${role}@user.com`.toLowerCase();
      const password = `${status}1-${role}`;

      const encryptedFullName = encryptFieldData(full_name);
      const encryptedEmail = encryptFieldData(email);

      const publicMembership: Partial<OrganizationMembership> = {
        organization: ZodObjectId.parse(ID.PublicOrg),
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
        // blocked_at: Date | null,
        // approved_at: today,
        // email_verified_at: today

        // deleted_at: Date | null,

        // last_logged_in_at: Date | null,
        // verification_token: string | null,
      };

      if (status === 'Archived') {
        newUser.archived_at = today; // archived|blocked mutually exclusive?
        newUser.blocked_at = null;
        newUser.approved_at = today; // should not matter
        newUser.email_verified_at = today; // should not matter
      }
      if (status === 'Blocked') {
        newUser.archived_at = null;
        newUser.blocked_at = today; // archived|blocked mutually exclusive?
        newUser.approved_at = today; // should not matter
        newUser.email_verified_at = today; // should not matter
      }
      if (status === 'Approved') {
        newUser.archived_at = null;
        newUser.blocked_at = null;
        newUser.approved_at = today;
        newUser.email_verified_at = today;
      }
      if (status === 'Verified') {
        newUser.archived_at = null;
        newUser.blocked_at = null;
        newUser.approved_at = null;
        newUser.email_verified_at = today;
      }
      if (status === 'Unverified') {
        newUser.archived_at = null;
        newUser.blocked_at = null;
        newUser.approved_at = null;
        newUser.email_verified_at = null;
      }

      await User.findOneAndUpdate(
        { 'full_name.hash': encryptedFullName.hash },
        newUser,
        { upsert: true }
      );
    }
  );

  const cleanUsers = [
    new User({
      full_name: encryptFieldData('John Super'),
      email: encryptFieldData('superadmin@public.com'),
      password: await encryptionService.generateHash(
        'SuperAdmin1-Public'
      ),
      is_guest: false,
      is_super_admin: true,
      organizations: [
        {
          organization: ID.PublicOrg,
          roles: [roles.SUPER_ADMIN],
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('John Admin'),
      email: encryptFieldData('admin@public.com'),
      password: await encryptionService.generateHash('Admin1-Public'),
      is_guest: false,
      organizations: [
        {
          organization: ID.PublicOrg,
          roles: [roles.ADMIN],
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('John Trainer'),
      email: encryptFieldData('trainer@public.com'),
      password: await encryptionService.generateHash('Trainer1-Public'),
      is_guest: false,
      organizations: [
        {
          organization: ID.PublicOrg,
          roles: [roles.TRAINER],
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      subscription: await createUserSubscription(roles.TRAINER),
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('John Learner'),
      email: encryptFieldData('learner@public.com'),
      password: await encryptionService.generateHash('Learner1-Public'),
      is_guest: false,
      organizations: [
        {
          organization: ID.PublicOrg,
          roles: [roles.LEARNER],
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    })
  ];

  const promises = [
    ...statusPromises,
    ...cleanUsers.map((user) => user.save())
  ];

  await Promise.all(promises);
}

async function seedOrg1() {
  const subscription = new Subscription({
    subscription_plan: ID.BasicPlan,
    status: SubscriptionStatusEnum.ACTIVE
  });
  await subscription.save();

  const org = new Organization({
    _id: ID['Org 1'],
    name: encryptFieldData('Org 1'),
    slug: encryptFieldData(kebabCase('Org 1')),
    code: '483623',
    subscription: subscription._id
  });
  await org.save();

  const users = [
    new User({
      full_name: encryptFieldData('Owner 1'),
      email: encryptFieldData('owner@org1.com'),
      password: await encryptionService.generateHash('Owner1-Org1'),
      is_guest: false,
      organizations: [
        {
          organization: ID['Org 1'],
          roles: [roles.ADMIN],
          is_owner: true,
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        },
        {
          organization: ID['Org 2'],
          roles: [roles.ADMIN],
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('Org Learner'),
      email: encryptFieldData('learner@org1.com'),
      password: await encryptionService.generateHash('Learner1-Org1'),
      is_guest: false,
      organizations: [
        {
          organization: ID['Org 1'],
          roles: [roles.LEARNER],
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('Org Admin'),
      email: encryptFieldData('admin@org1.com'),
      password: await encryptionService.generateHash('Admin1-Org1'),
      is_guest: false,
      organizations: [
        {
          organization: ID['Org 1'],
          roles: [roles.ADMIN],
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('Org Trainer'),
      email: encryptFieldData('trainer@org1.com'),
      password: await encryptionService.generateHash('Trainer1-Org1'),
      is_guest: false,
      organizations: [
        {
          organization: ID['Org 1'],
          roles: [roles.TRAINER],
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    })
  ];

  await Promise.all(users.map((user) => user.save()));
}

async function seedOrg2() {
  const subscription = new Subscription({
    subscription_plan: ID.BasicPlan,
    status: SubscriptionStatusEnum.ACTIVE
  });
  await subscription.save();

  const org = new Organization({
    _id: ID['Org 2'],
    name: encryptFieldData('Org 2'),
    slug: encryptFieldData(kebabCase('Org 2')),
    code: 'AF816D',
    subscription: subscription._id
  });
  await org.save();

  const users = [
    new User({
      full_name: encryptFieldData('Owner 2'),
      email: encryptFieldData('owner@org2.com'),
      password: await encryptionService.generateHash('Owner1-Org2'),
      is_guest: false,
      organizations: [
        {
          organization: ID['Org 2'],
          roles: [roles.ADMIN],
          is_owner: true,
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    }),
    new User({
      full_name: encryptFieldData('Org Learner'),
      email: encryptFieldData('newlearner@org2.com'),
      password: await encryptionService.generateHash(
        'NewLearner1-Org2'
      ),
      is_guest: false,
      organizations: [
        {
          organization: ID['Org 2'],
          roles: [roles.LEARNER],
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    })
  ];

  await Promise.all(users.map((user) => user.save()));
}

async function seedOrg3() {
  const subscription = new Subscription({
    subscription_plan: ID.BasicPlan,
    status: SubscriptionStatusEnum.ACTIVE
  });
  await subscription.save();

  const org = new Organization({
    _id: ID['Org 3'],
    name: encryptFieldData('Org 3'),
    slug: encryptFieldData(kebabCase('Org 3')),
    code: '5380DD',
    subscription: subscription._id
  });
  await org.save();

  const users = [
    new User({
      full_name: encryptFieldData('Org Learner'),
      email: encryptFieldData('newlearner@org3.com'),
      password: await encryptionService.generateHash(
        'NewLearner1-Org3'
      ),
      is_guest: false,
      organizations: [
        {
          organization: ID['Org 3'],
          roles: [roles.LEARNER],
          status: invitationStatus.ACCEPTED,
          accepted_at: today
        }
      ],
      archived_at: null,
      blocked_at: null,
      approved_at: today,
      email_verified_at: today
    })
  ];

  await Promise.all(users.map((user) => user.save()));
}

async function seedOrg4() {
  const subscription = new Subscription({
    subscription_plan: ID.BasicPlan,
    status: SubscriptionStatusEnum.ACTIVE
  });
  await subscription.save();

  const org = new Organization({
    _id: ID['Org 4'],
    name: encryptFieldData('Org 4'),
    slug: encryptFieldData(kebabCase('Org 4')),
    code: 'ECCBE6',
    subscription: subscription._id
  });
  await org.save();

  const users = [];

  // await Promise.all(users.map((user) => user.save()));
}

async function seedRegularOrganizations() {
  await Promise.all([seedOrg1(), seedOrg2(), seedOrg3(), seedOrg4()]);
}

async function seedBasicOrganizationPlan() {
  const features_html = [
    '<p>60 active learner seats</p>',
    '<p>Unlimited access to <strong>all Public Level 1 services</strong> on the platform for learners</p>',
    '<p>Unlimited access to <strong>all Private Level 1 services</strong> on the platform for learners</p>',
    '<p>Unlimited creation of <strong>Private Level 1 services</strong> for trainers</p>',
    '<p>User support</p>'
  ];
  const features = features_html.map(
    (html) => htmlParser.parse(html).textContent
  );

  const plan = new SubscriptionPlan({
    _id: ID.BasicPlan,
    name: 'Basic',
    description: 'Basic subscription plan for organizations',
    subscription_plan_for: SubscriptionPlanForEnum.ORGANIZATION,
    price: 1_500,
    max_learners: 60,
    extra_learner_price: 30,
    is_active: true,
    details: '',
    features,
    features_html
  });
  await plan.save();
}

async function seedPublicTrainerPlan() {
  const features_html = [
    '<p>Unlimited creation of <strong>Draft services</strong></p>',
    '<p><strong>3 Public Level 1 services</strong></p>',
    '<p>User support</p>'
  ];
  const features = features_html.map(
    (html) => htmlParser.parse(html).textContent
  );

  const plan = new SubscriptionPlan({
    _id: ID.PublicTrainerPlan,
    name: 'Public',
    description: 'Plan for public trainers',
    subscription_plan_for: SubscriptionPlanForEnum.PUBLIC_TRAINER,
    price: 0,
    max_learners: 0,
    extra_learner_price: 0,
    is_active: true,
    details: '',
    features,
    features_html
  });
  await plan.save();
}

async function seedSubscriptionPlans() {
  await Promise.all([
    seedBasicOrganizationPlan(),
    seedPublicTrainerPlan()
  ]);
}

/**
 * Create separate functions for values to be added to the memory database,
 * e.g. `seedResults()` for simulation results,
 * then await them here for them to be available during tests.
 */
async function seed() {
  await Promise.all([
    seedPublicOrganization(),
    seedRegularOrganizations(),
    seedSubscriptionPlans()
  ]);
}

export function setupMemoryDb() {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    await mongoose.connect(mongod.getUri());

    await seed();
  });

  afterAll(async () => {
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();

    await mongod.stop();
  });
}
