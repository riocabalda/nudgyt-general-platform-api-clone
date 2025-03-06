import createHttpError from 'http-errors';
import organizationConfig from '../config/organization.config';
import { Permission } from '../constants/permissions';
import roles from '../constants/roles';
import asyncWrapper from '../helpers/async-wrapper';
import { encryptFieldData } from '../helpers/db';
import { OrganizationMembershipPopulated } from '../models/user.model';

export type RequestAuth = {
  /** Membership that authorized the user through the middleware */
  membership: OrganizationMembershipPopulated;

  /** Organization role that authorized the user through the middleware */
  role: string;
};

declare global {
  namespace Express {
    interface Request {
      auth: RequestAuth;
    }
  }
}

function findAuthorizedRole(
  requiredPermissions: Permission[],
  membership: OrganizationMembershipPopulated
) {
  const orgPermissions = membership.organization.permissions;
  for (const permissionEntry of orgPermissions) {
    const { permissions } = permissionEntry;

    let role = permissionEntry.role;
    if (role === 'Owner') role = 'Admin';

    const isMatchingRole = membership.roles.includes(role);
    if (!isMatchingRole) continue;

    const isMatchingPermissions = permissions.some((permission) =>
      requiredPermissions.includes(permission)
    );
    if (!isMatchingPermissions) continue;

    return role;
  }

  return null;
}

function* generateUserPermissions(
  membership: OrganizationMembershipPopulated
): Generator<Permission> {
  const orgPermissions = membership.organization.permissions;

  for (const { role, permissions } of orgPermissions) {
    if (role === 'Owner') {
      if (membership.is_owner) yield* permissions;

      continue;
    }

    const isRoleOfUser = membership.roles.includes(role);
    if (!isRoleOfUser) continue;

    yield* permissions;
  }
}

const requirePermissions = (
  requiredPermissions: Permission[],
  options: {
    /** Mainly used in users management */
    allowPublicAdmins?: boolean;
  } = {}
) =>
  asyncWrapper(async (req, res, next) => {
    const { allowPublicAdmins = false } = options;

    const orgSlug = req.params.org;
    const user = req.user;

    if (allowPublicAdmins) {
      const encryptedPublicOrgName = encryptFieldData(
        organizationConfig.PUBLIC_ORGANIZATION_NAME
      );

      const publicAdminMembership = user.organizations?.find(
        (membership) => {
          const isPublicMember =
            membership.organization.name.hash ===
            encryptedPublicOrgName.hash;
          const isPublicAdmin = membership.roles.some(
            (role) => role === roles.ADMIN || role === roles.SUPER_ADMIN
          );

          return isPublicMember && isPublicAdmin;
        }
      );

      if (publicAdminMembership !== undefined) {
        req.auth = {
          membership: publicAdminMembership,
          role: publicAdminMembership.roles[0]
        };

        return next();
      }
    }

    const encryptedOrgSlug = encryptFieldData(orgSlug);

    const membership = user.organizations?.find(
      (membership) =>
        membership.organization.slug.hash === encryptedOrgSlug.hash
    );
    if (membership === undefined)
      throw createHttpError.Forbidden(
        'Not a member of this organization'
      );

    const userPermissionSet = new Set(
      generateUserPermissions(membership)
    );

    const hasAllRequiredPermissions = requiredPermissions.every(
      (permission) => userPermissionSet.has(permission)
    );
    if (!hasAllRequiredPermissions)
      throw createHttpError.Forbidden('Insufficient permissions');

    const authorizedRole = findAuthorizedRole(
      requiredPermissions,
      membership
    );
    if (authorizedRole === null)
      throw createHttpError.Forbidden('Role not found'); // Should not be possible...

    req.auth = {
      membership,
      role: authorizedRole
    };

    return next();
  });

export default requirePermissions;
