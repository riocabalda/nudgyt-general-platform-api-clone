import { encryptFieldData } from '../helpers/db';
import { UserType } from '../models/user.model';

/** Only gets first role */
export function getUserRole({
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

  const role = userOrg?.roles[0] ?? null;

  return role;
}
