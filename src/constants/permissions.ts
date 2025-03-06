import roles from './roles';

export type Permission = (typeof PERMISSIONS)[number];

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

export const PERMISSIONS = [
  /** Dashboard */
  'VIEW_DASHBOARD',

  /** Services */
  'VIEW_SERVICES',
  'CREATE_SERVICES',
  'UPDATE_SERVICES',
  'DELETE_SERVICES',

  /** Templates */
  'VIEW_TEMPLATES',
  'CREATE_TEMPLATES',
  'UPDATE_TEMPLATES',
  'DELETE_TEMPLATES',

  /** Characters */
  'VIEW_CHARACTERS',
  'CREATE_CHARACTERS',
  'UPDATE_CHARACTERS',
  'DELETE_CHARACTERS',

  /** Simulations */
  'CREATE_SIMULATIONS',

  /** Simulation Transcripts */
  'CREATE_TRANSCRIPTS',

  /** Users */
  'VIEW_USERS',
  'CREATE_USERS',
  'UPDATE_USERS',
  'DELETE_USERS',

  /** Organizations */
  'VIEW_ORGANIZATIONS',
  'CREATE_ORGANIZATIONS',
  'UPDATE_ORGANIZATIONS',
  'DELETE_ORGANIZATIONS',

  /** Organization Settings */
  'VIEW_ORGANIZATION_SETTINGS',
  'CREATE_ORGANIZATION_SETTINGS',
  'UPDATE_ORGANIZATION_SETTINGS',
  // 'DELETE_ORGANIZATION_SETTINGS', // Not possible

  /** Organization Subscription */
  'VIEW_ORGANIZATION_SUBSCRIPTION',
  'CREATE_ORGANIZATION_SUBSCRIPTION',
  'UPDATE_ORGANIZATION_SUBSCRIPTION',
  // 'DELETE_ORGANIZATION_SUBSCRIPTION', // Not possible

  /** Organization Usage */
  'VIEW_ORGANIZATION_USAGE',

  /** Invitations */
  'CREATE_INVITATIONS',
  'UPDATE_INVITATIONS',

  /** Logs */
  'VIEW_LOGS',

  /** Account */
  'VIEW_ACCOUNT',
  'CREATE_ACCOUNT',
  'UPDATE_ACCOUNT',
  // 'DELETE_ACCOUNT', // Not possible

  /** Subscription */
  'VIEW_SUBSCRIPTION',
  'CREATE_SUBSCRIPTION',
  'UPDATE_SUBSCRIPTION'
  // 'DELETE_SUBSCRIPTION' // Not possible
] as const;

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

const PermissionRecord: PermissionEntry[] = [
  ['VIEW_DASHBOARD', PermissionGroup.EVERYONE],
  ['VIEW_SERVICES', PermissionGroup.EVERYONE],
  ['CREATE_SERVICES', PermissionGroup.ADMINS_AND_TRAINERS],
  ['UPDATE_SERVICES', PermissionGroup.ADMINS_AND_TRAINERS],
  ['DELETE_SERVICES', PermissionGroup.ADMINS_AND_TRAINERS],
  ['VIEW_TEMPLATES', PermissionGroup.ADMINS_AND_TRAINERS],
  ['CREATE_TEMPLATES', PermissionGroup.ADMINS_AND_TRAINERS],
  ['UPDATE_TEMPLATES', PermissionGroup.ADMINS_AND_TRAINERS],
  ['DELETE_TEMPLATES', PermissionGroup.ADMINS_AND_TRAINERS],
  ['VIEW_CHARACTERS', PermissionGroup.ADMINS_AND_TRAINERS],
  ['CREATE_CHARACTERS', PermissionGroup.ADMINS_AND_TRAINERS],
  ['UPDATE_CHARACTERS', PermissionGroup.ADMINS_AND_TRAINERS],
  ['DELETE_CHARACTERS', PermissionGroup.ADMINS_AND_TRAINERS],
  ['CREATE_SIMULATIONS', PermissionGroup.LEARNERS],
  ['CREATE_TRANSCRIPTS', PermissionGroup.LEARNERS],
  ['VIEW_USERS', PermissionGroup.ADMINS],
  ['CREATE_USERS', PermissionGroup.ADMINS],
  ['UPDATE_USERS', PermissionGroup.ADMINS],
  ['DELETE_USERS', PermissionGroup.ADMINS],
  ['VIEW_ORGANIZATIONS', PermissionGroup.ADMINS],
  ['CREATE_ORGANIZATIONS', PermissionGroup.PUBLIC_ADMINS],
  ['UPDATE_ORGANIZATIONS', PermissionGroup.PUBLIC_ADMINS],
  ['DELETE_ORGANIZATIONS', PermissionGroup.PUBLIC_ADMINS],
  ['VIEW_ORGANIZATION_SETTINGS', { organizationOwner: true }],
  ['CREATE_ORGANIZATION_SETTINGS', { organizationOwner: true }],
  ['UPDATE_ORGANIZATION_SETTINGS', { organizationOwner: true }],
  ['VIEW_ORGANIZATION_SUBSCRIPTION', { organizationOwner: true }],
  ['CREATE_ORGANIZATION_SUBSCRIPTION', { organizationOwner: true }],
  ['UPDATE_ORGANIZATION_SUBSCRIPTION', { organizationOwner: true }],
  ['VIEW_ORGANIZATION_USAGE', { organizationOwner: true }],
  ['CREATE_INVITATIONS', PermissionGroup.ADMINS],
  ['UPDATE_INVITATIONS', PermissionGroup.EVERYONE],
  ['VIEW_LOGS', PermissionGroup.ADMINS],
  ['VIEW_ACCOUNT', PermissionGroup.EVERYONE],
  ['CREATE_ACCOUNT', PermissionGroup.EVERYONE],
  ['UPDATE_ACCOUNT', PermissionGroup.EVERYONE],
  ['VIEW_SUBSCRIPTION', PermissionGroup.PUBLIC_USERS],
  ['CREATE_SUBSCRIPTION', PermissionGroup.PUBLIC_USERS],
  ['UPDATE_SUBSCRIPTION', PermissionGroup.PUBLIC_USERS]
];

function selectRecordColumn(column: keyof PermissionColumn) {
  return PermissionRecord.filter(
    ([_, permissionColumn]) => permissionColumn[column]
  ).map(([permission]) => permission);
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
    role: 'Super Admin',
    permissions: selectRecordColumn('publicSuperAdmin')
  }
];
