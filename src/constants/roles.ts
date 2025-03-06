const roles = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  TRAINER: 'Trainer',
  LEARNER: 'Learner'
} as const;

export const USER_ROLES = Object.values(roles);

type UserRole = (typeof USER_ROLES)[number];

export type { UserRole };
export default roles;
