import connectDb from '../helpers/db';
import seedAvatar from './avatar';
import seedEnvironment from './environment';
import seedOrganization from './organization';
import seedSampleEnterprises from './sample-enterprises';
import seedSampleOrganizations from './sample-organizations';
import seedSampleUsers from './sample-users';
import seedSampleUsersPublic from './sample-users-public';
import seedServiceType from './service-type';
import seedSubscriptionPlan from './subscription-plan';
import seedSuperAdmin from './superadmin';

const VALID_SEED_TYPES = new Set([
  'avatar',
  'environment',
  'organization',
  'servicetype',
  'superadmin',
  'subscription-plan',
  'sample-users',
  'sample-users-public',
  'sample-organizations',
  'sample-enterprises'
]);

const validSeedTypesStr = [...VALID_SEED_TYPES]
  .map((type) => `"${type}"`)
  .join(', ');

async function seedDatabase(seedTypes: Set<string>) {
  const promises: Promise<unknown>[] = [];

  if (seedTypes.has('avatar')) {
    await seedAvatar();
  }
  if (seedTypes.has('environment')) {
    await seedEnvironment();
  }
  if (seedTypes.has('organization')) {
    await seedOrganization(); // Awaited separately as others depend on this
  }
  if (seedTypes.has('servicetype')) {
    await seedServiceType();
  }
  if (seedTypes.has('superadmin')) {
    promises.push(seedSuperAdmin());
  }
  if (seedTypes.has('subscription-plan')) {
    await seedSubscriptionPlan(); // Awaited separately as others depend on this
  }
  if (seedTypes.has('sample-users')) {
    promises.push(seedSampleUsers());
  }
  if (seedTypes.has('sample-users-public')) {
    promises.push(seedSampleUsersPublic());
  }
  if (seedTypes.has('sample-organizations')) {
    promises.push(seedSampleOrganizations());
  }
  if (seedTypes.has('sample-enterprises')) {
    promises.push(seedSampleEnterprises());
  }

  await Promise.all(promises);
}

function getCliSeedTypes() {
  const args = process.argv.slice(2); // Get command-line arguments

  const cliSeedTypes = new Set(args); // Use a Set to handle duplicates
  if (cliSeedTypes.size === 0) {
    throw new Error(
      `No valid seed type provided. Use ${validSeedTypesStr}.`
    );
  }

  const invalidSeedTypes = [...cliSeedTypes].filter(
    (type) => !VALID_SEED_TYPES.has(type)
  );
  if (invalidSeedTypes.length > 0) {
    const invalidSeedTypesStr = invalidSeedTypes
      .map((type) => `"${type}"`)
      .join(', ');

    throw new Error(
      `Invalid seed type(s): ${invalidSeedTypesStr}. Valid types are ${validSeedTypesStr}.`
    );
  }

  return cliSeedTypes;
}

async function run() {
  try {
    const seedTypes = getCliSeedTypes();

    await connectDb();
    await seedDatabase(seedTypes);

    process.exit(0);
  } catch (error) {
    console.error(`Error during seeding: ${error}`);

    process.exit(1);
  }
}

run();
