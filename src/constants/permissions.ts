import roles from './roles';

export type Permission = keyof typeof PermissionRecord;

type PermissionColumn = {
  publicLearner?: true;
  publicTrainer?: true;
  // publicOwner?: true, // Not possible
  publicAdmin?: true;
  publicSuperAdmin?: true;
  organizationLearner?: true;
  organizationTrainer?: true;
  organizationOwner?: true;
  organizationAdmin?: true;
  // organizationSuperAdmin?: true, // Not possible
};

type PermissionEntry = [Permission, PermissionColumn];

const PermissionGroup = {
  EVERYONE: {
    publicLearner: true,
    publicTrainer: true,
    publicAdmin: true,
    publicSuperAdmin: true,
    organizationLearner: true,
    organizationTrainer: true,
    organizationOwner: true,
    organizationAdmin: true
  },
  ADMINS_AND_TRAINERS: {
    publicTrainer: true,
    publicAdmin: true,
    publicSuperAdmin: true,
    organizationTrainer: true,
    organizationOwner: true,
    organizationAdmin: true
  },
  ADMINS: {
    publicAdmin: true,
    publicSuperAdmin: true,
    organizationOwner: true,
    organizationAdmin: true
  },
  LEARNERS: {
    publicLearner: true,
    organizationLearner: true
  },
  PUBLIC_ADMINS: {
    publicAdmin: true,
    publicSuperAdmin: true
  },
  PUBLIC_USERS: {
    publicLearner: true,
    publicTrainer: true
  }
} as const satisfies Record<string, PermissionColumn>;

/**
 * Add new permissions as keys
 * - Use Pascal case, e.g. `Resource.SubResource.Action`
 * - Re-run `npm run seed permissions` when updating this object!
 *
 * Actions can be:
 * - View (replacing Read from CRUD)
 * - Create
 * - Update
 * - Delete
 *
 * Main resource is required
 * - Sub-resource is optional
 * - Both must be singular, e.g. `Character.View`, not `Characters.View`
 *
 * Values are objects of `PermissionColumn` type
 * - Can add new fields to the type as needed
 * - `PermissionGroup` is just a shared reference for common permissions
 * - Visualize this object as a table with permissions as rows and roles as columns
 */
const PermissionRecord = {
  'Dashboard.View': PermissionGroup.EVERYONE,
  'Service.View': PermissionGroup.EVERYONE,
  'Service.Create': PermissionGroup.ADMINS_AND_TRAINERS,
  'Service.Update': PermissionGroup.ADMINS_AND_TRAINERS,
  'Service.Delete': PermissionGroup.ADMINS_AND_TRAINERS,
  'Template.View': PermissionGroup.ADMINS_AND_TRAINERS,
  'Template.Create': PermissionGroup.ADMINS_AND_TRAINERS,
  'Template.Update': PermissionGroup.ADMINS_AND_TRAINERS,
  'Template.Delete': PermissionGroup.ADMINS_AND_TRAINERS,
  'Character.View': PermissionGroup.ADMINS_AND_TRAINERS,
  'Character.Create': PermissionGroup.ADMINS_AND_TRAINERS,
  'Character.Update': PermissionGroup.ADMINS_AND_TRAINERS,
  'Character.Delete': PermissionGroup.ADMINS_AND_TRAINERS,
  'Character.Voice.View': PermissionGroup.ADMINS_AND_TRAINERS,
  'Character.Language.View': PermissionGroup.ADMINS_AND_TRAINERS,
  'Simulation.View': PermissionGroup.EVERYONE,
  'Simulation.Create': PermissionGroup.LEARNERS,
  'Transcript.Comment.Create': PermissionGroup.ADMINS_AND_TRAINERS,
  'Transcript.Comment.Delete': PermissionGroup.ADMINS_AND_TRAINERS,
  'Transcript.Create': PermissionGroup.LEARNERS,
  'User.View': PermissionGroup.ADMINS,
  'User.Create': PermissionGroup.ADMINS,
  'User.Update': PermissionGroup.ADMINS,
  'User.Delete': PermissionGroup.ADMINS,
  'User.Experience.View': PermissionGroup.EVERYONE,
  'Organization.View': PermissionGroup.ADMINS,
  'Organization.Create': PermissionGroup.PUBLIC_ADMINS,
  'Organization.Update': PermissionGroup.PUBLIC_ADMINS,
  'Organization.Delete': PermissionGroup.PUBLIC_ADMINS,
  'Organization.Settings.View': { organizationOwner: true },
  'Organization.Settings.Create': { organizationOwner: true },
  'Organization.Settings.Update': { organizationOwner: true },
  'Organization.Subscription.View': { organizationOwner: true },
  'Organization.Subscription.Create': { organizationOwner: true },
  'Organization.Subscription.Update': { organizationOwner: true },
  'Organization.Usage.View': { organizationOwner: true },
  'Invitation.Create': PermissionGroup.ADMINS,
  'Invitation.Update': PermissionGroup.ADMINS,
  'Log.View': PermissionGroup.ADMINS,
  'Account.View': PermissionGroup.EVERYONE,
  'Account.Create': PermissionGroup.EVERYONE,
  'Account.Update': PermissionGroup.EVERYONE,
  'Account.Subscription.View': PermissionGroup.PUBLIC_USERS,
  'Account.Subscription.Create': PermissionGroup.PUBLIC_USERS,
  'Account.Subscription.Update': PermissionGroup.PUBLIC_USERS,
  'Avatar.View': PermissionGroup.EVERYONE,
  'Avatar.Create': PermissionGroup.PUBLIC_ADMINS,
  'Avatar.Update': PermissionGroup.PUBLIC_ADMINS,
  'Avatar.Delete': PermissionGroup.PUBLIC_ADMINS,
  'Environment.View': PermissionGroup.EVERYONE,
  'Environment.Create': PermissionGroup.PUBLIC_ADMINS,
  'Environment.Update': PermissionGroup.PUBLIC_ADMINS,
  'Environment.Delete': PermissionGroup.PUBLIC_ADMINS
} as const satisfies Record<string, PermissionColumn>;

export const PERMISSIONS = Object.keys(
  PermissionRecord
) as Permission[];

function selectRecordColumn(column: keyof PermissionColumn) {
  const entries = Object.entries(PermissionRecord) as PermissionEntry[];

  return entries
    .filter(([_, permissionColumn]) => permissionColumn[column])
    .map(([permission]) => permission);
}

export const OrganizationPermissions = [
  {
    role: roles.LEARNER,
    permissions: selectRecordColumn('organizationLearner')
  },
  {
    role: roles.TRAINER,
    permissions: selectRecordColumn('organizationTrainer')
  },
  {
    role: roles.ADMIN,
    permissions: selectRecordColumn('organizationAdmin')
  },
  {
    role: 'Owner',
    permissions: selectRecordColumn('organizationOwner')
  }
];
export const PublicOrganizationPermissions = [
  {
    role: roles.LEARNER,
    permissions: selectRecordColumn('publicLearner')
  },
  {
    role: roles.TRAINER,
    permissions: selectRecordColumn('publicTrainer')
  },
  {
    role: roles.ADMIN,
    permissions: selectRecordColumn('publicAdmin')
  },
  {
    role: roles.SUPER_ADMIN,
    permissions: selectRecordColumn('publicSuperAdmin')
  }
];
