import { kebabCase } from 'lodash';
import organizationConfig from '../config/organization.config';
import { PublicOrganizationPermissions } from '../constants/permissions';
import { encryptFieldData } from '../helpers/db';
import Organization from '../models/organization.model';
import organizationService from '../services/organization.service';

async function insertPublicOrganization() {
  const name = organizationConfig.PUBLIC_ORGANIZATION_NAME;
  const slug = kebabCase(name);
  const code = await organizationService.randomOrganizationCode();

  const encryptedName = encryptFieldData(name);

  await Organization.findOneAndUpdate(
    { 'name.hash': encryptedName.hash },
    {
      name: encryptedName,
      slug: encryptFieldData(slug),
      code,
      permissions: PublicOrganizationPermissions as any
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function seedOrganization() {
  try {
    console.log('Seeding Organization...');

    await Promise.all([insertPublicOrganization()]);

    console.log('Organization seeded.');
  } catch (error) {
    throw new Error(`Error seeding Organization: ${error}`);
  }
}

export default seedOrganization;
