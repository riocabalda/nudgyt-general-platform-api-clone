import createHttpError from 'http-errors';
import { UserType } from '../models/user.model';
import { encryptFieldData } from '../helpers/db';

export const isSuperAdmin = (user: UserType): boolean => {
  return (
    user.organizations?.some((membership) =>
      membership.roles.includes('Super Admin')
    ) || false
  );
};

// Helper function to validate organization membership
export const validateOrgMembership = (
  user: UserType,
  org: string,
  actingUser: UserType
) => {
  // Skip validation if acting user is Super Admin
  if (isSuperAdmin(actingUser)) {
    return true;
  }

  const encryptedOrg = encryptFieldData(org);
  const orgMembership = user.organizations?.find(
    (m) => m.organization.slug === encryptedOrg
  );
  if (!orgMembership) {
    throw createHttpError.NotFound(
      'User does not belong to this organization'
    );
  }
  return true;
};
