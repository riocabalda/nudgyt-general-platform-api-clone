import { encryptFieldData } from '../helpers/db';
import { UserType } from '../models/user.model';

export function getOrgIdByOrgSlug({
  user,
  org
}: {
  user: UserType;
  org: string;
}) {
  const encryptedOrgSlug = encryptFieldData(org);

  const userOrg = user.organizations?.find(
    (item) => item.organization.slug.hash === encryptedOrgSlug.hash
  );
  return userOrg?.organization._id || null;
}
