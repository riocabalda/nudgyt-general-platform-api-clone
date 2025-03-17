import organizationConfig from '../config/organization.config';
import {
  OrganizationPermissions,
  PublicOrganizationPermissions
} from '../constants/permissions';
import { decryptFieldData } from '../helpers/db';
import Organization from '../models/organization.model';

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

async function seedPermissions() {
  try {
    console.log('Seeding Permissions...');

    await Promise.all([addPermissionsToExistingOrganizations()]);

    console.log('Permissions seeded.');
  } catch (error) {
    throw new Error(`Error seeding Permissions: ${error}`);
  }
}

export default seedPermissions;
