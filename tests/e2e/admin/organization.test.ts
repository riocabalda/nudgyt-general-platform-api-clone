import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import z from 'zod';
import app from '../../../src/app';
import { setupMemoryDb } from '../../utils/db';
import { login } from '../../utils/login';

setupMemoryDb();

describe('Display info', () => {
  it('Cannot be accessed by non-members', async () => {
    const email = 'approved.admin@user.com';
    const password = 'Approved1-Admin';
    const orgSlug = 'org-1'; // Not a member of this organization

    const { token } = await login(email, password);
    const response = await request(app)
      .get(`/api/${orgSlug}/admin/organizations/display-info`)
      .set('Authorization', `Bearer: ${token}`)
      .query({ orgSlug });

    expect(response.status).toEqual(StatusCodes.UNAUTHORIZED);
  });

  const TEST_DATA = [
    {
      description: 'Gives no info for public admins',
      email: 'approved.admin@user.com',
      password: 'Approved1-Admin',
      orgSlug: 'public',
      expectedName: undefined,
      expectedCode: undefined
    },
    {
      description: 'Gives only name for organization admins',
      email: 'admin@org1.com',
      password: 'Admin1-Org1',
      orgSlug: 'org-1',
      expectedName: 'Org 1',
      expectedCode: undefined
    },
    {
      description: 'Gives no info for system admins',
      email: 'admin1@system.com',
      password: 'Admin1-System',
      orgSlug: 'system',
      expectedName: undefined,
      expectedCode: undefined
    },
    {
      description: 'Gives name and code for organization owners',
      email: 'owner@org1.com',
      password: 'Owner1-Org1',
      orgSlug: 'org-1',
      expectedName: 'Org 1',
      expectedCode: '483623'
    },
    {
      description: 'Gives no info for system super admins',
      email: 'superadmin@system.com',
      password: 'SuperAdmin1-System',
      orgSlug: 'system',
      expectedName: undefined,
      expectedCode: undefined
    }
  ];

  for (const data of TEST_DATA) {
    const { description } = data;
    const { email, password, orgSlug } = data;
    const { expectedName, expectedCode } = data;

    it(description, async () => {
      const { token } = await login(email, password);

      const response = await request(app)
        .get(`/api/${orgSlug}/admin/organizations/display-info`)
        .set('Authorization', `Bearer: ${token}`);

      expect(response.body.data.name).toEqual(expectedName);
      expect(response.body.data.code).toEqual(expectedCode);
    });
  }
});

describe('Managed', () => {
  it('Should only give specific test organizations that the test user is part of', async () => {
    const expectedOrgs = ['Org 1', 'Org 2'];
    const expectedRoles = ['Admin'];

    const email = 'owner@org1.com';
    const password = 'Owner1-Org1';
    const orgSlug = 'org-1';
    const { token } = await login(email, password);

    const response = await request(app)
      .get(`/api/${orgSlug}/admin/organizations/managed`)
      .set('Authorization', `Bearer: ${token}`);

    const ManagedOrgSchema = z.object({
      _id: z.string(),
      name: z.string(),
      roles: z.string().array()
    });
    const ResponseBodySchema = z.object({
      message: z.literal('OK'),
      data: ManagedOrgSchema.array()
    });

    const body = ResponseBodySchema.parse(response.body);
    const managedOrgs = body.data;

    /** Must receive expected count */
    expect(expectedOrgs.length).toEqual(managedOrgs.length);

    /** Must receive expected organizations */
    const managedOrgNames = managedOrgs.map((org) => org.name);
    const areAllExpectedTestOrgsPresent = expectedOrgs.every((org) =>
      managedOrgNames.includes(org)
    );
    expect(areAllExpectedTestOrgsPresent).toEqual(true);

    /** Must receive expected roles */
    const managedOrgRoleSet = new Set(
      managedOrgs.flatMap((org) => org.roles)
    );
    const areAllRolesValid = expectedRoles.every((role) =>
      managedOrgRoleSet.has(role)
    );
    expect(areAllRolesValid).toEqual(true);
  });
});
