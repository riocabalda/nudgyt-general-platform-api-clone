import bcrypt from 'bcrypt';
import organizationConfig from '../config/organization.config';
import seederConfig from '../config/seeder.config';
import invitationStatus from '../constants/invitation-status';
import roles from '../constants/roles';
import { encryptFieldData } from '../helpers/db';
import Organization from '../models/organization.model';
import User, { OrganizationMembership } from '../models/user.model';

async function insertSuperAdmin() {
  const email = seederConfig.superAdminEmail;
  const password = seederConfig.superAdminPassword;
  const hashedPassword: string = await bcrypt.hash(password, 10);

  const encryptedPublicOrgName = encryptFieldData(
    organizationConfig.PUBLIC_ORGANIZATION_NAME
  );
  const encryptedFullName = encryptFieldData('Super Admin');
  const encryptedEmail = encryptFieldData(email);

  const publicOrgDoc = await Organization.findOne({
    'name.hash': encryptedPublicOrgName.hash
  });
  if (publicOrgDoc === null) {
    throw new Error(
      'Public organization does not exist; try seeding organizations'
    );
  }

  const publicOrgMembership: Partial<OrganizationMembership> = {
    organization: publicOrgDoc._id,
    roles: [roles.SUPER_ADMIN],
    status: invitationStatus.ACCEPTED,
    accepted_at: new Date(),

    approved_at: new Date()
  };

  await User.findOneAndUpdate(
    { 'full_name.hash': encryptedFullName.hash },
    {
      email: encryptedEmail,
      full_name: encryptedFullName,
      email_verified_at: new Date(),
      password: hashedPassword,
      is_super_admin: true,
      organizations: [publicOrgMembership]
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function seedSuperAdmin() {
  try {
    console.log('Seeding Super Admin...');

    await Promise.all([insertSuperAdmin()]);

    console.log('Super Admin seeded.');
  } catch (error) {
    throw new Error(`Error seeding Super Admin: ${error}`);
  }
}

export default seedSuperAdmin;
