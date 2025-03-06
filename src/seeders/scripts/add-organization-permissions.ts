import organizationConfig from '../../config/organization.config';
import {
  OrganizationPermissions,
  PublicOrganizationPermissions
} from '../../constants/permissions';
import connectDb, { decryptFieldData } from '../../helpers/db';
import Organization from '../../models/organization.model';

async function addPermissionsToExistingOrganizations() {
  const orgDocs = await Organization.find();

  const promises = orgDocs.map(async (orgDoc) => {
    const orgName = decryptFieldData(orgDoc.name);
    console.log(`Adding permissions to ${orgName}...`);

    const isPublicOrg =
      orgName === organizationConfig.PUBLIC_ORGANIZATION_NAME;
    if (isPublicOrg) {
      orgDoc.permissions = PublicOrganizationPermissions as any;
    } else {
      orgDoc.permissions = OrganizationPermissions as any;
    }

    await orgDoc.save();
    console.log(`${orgName} permissions added.`);
  });

  await Promise.all(promises);
}

async function run() {
  try {
    await connectDb();
    await addPermissionsToExistingOrganizations();

    process.exit(0);
  } catch (error) {
    console.error(
      `Failed adding permissions to existing organizations: ${error}`
    );

    process.exit(1);
  }
}

run();
