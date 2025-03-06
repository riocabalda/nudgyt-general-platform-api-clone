import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import z from 'zod';
import app from '../../../src/app';
import organizationConfig from '../../../src/config/organization.config';
import User from '../../../src/models/user.model';
import { ID, setupMemoryDb } from '../../utils/db';
import { withMockMail } from '../../utils/interceptors';
import { login } from '../../utils/login';

setupMemoryDb();

describe('Invite', () => {
  const Manager = {
    RegularOrganization: {
      email: 'owner@org1.com',
      password: 'Owner1-Org1',
      orgSlug: 'org-1'
    },
    System: {
      email: 'superadmin@system.com',
      password: 'SuperAdmin1-System',
      orgSlug: 'system'
    },
    Public: {
      email: 'approved.admin@user.com',
      password: 'Approved1-Admin',
      orgSlug: 'public'
    }
  };

  async function expectSuperAdminFailure(
    credentials: { email: string; password: string; orgSlug: string },
    reqBody: {
      email: string;
      role: string;
      organization?: string;
    }
  ) {
    const { token } = await login(
      credentials.email,
      credentials.password
    );

    const response = await request(app)
      .post(`/api/${credentials.orgSlug}/admin/users/invite`)
      .set('Authorization', `Bearer: ${token}`)
      .send(reqBody);

    const ResponseBodySchema = z.tuple([
      z.object({
        type: z.literal('Body'),
        errors: z.object({
          issues: z.tuple([
            z.object({
              message: z.string()
            })
          ])
        })
      })
    ]);
    const body = ResponseBodySchema.parse(response.body);

    /** Must receive expected status code */
    expect(response.status).toEqual(StatusCodes.BAD_REQUEST);

    /** Must receive expected error message */
    const { message } = body[0].errors.issues[0];
    expect(message).toEqual('Invalid user type.');
  }

  async function expectInviteSuccess(
    credentials: { email: string; password: string; orgSlug: string },
    reqBody: {
      email: string;
      role: string;
      organization?: string;
    }
  ) {
    await withMockMail(async () => {
      const { token } = await login(
        credentials.email,
        credentials.password
      );

      const response = await request(app)
        .post(`/api/${credentials.orgSlug}/admin/users/invite`)
        .set('Authorization', `Bearer: ${token}`)
        .send(reqBody);

      /** Must receive successful message */
      expect(response.body.message).toEqual('Invitation sent!');
    });
  }

  it('Cannot invite without specifying organization', async () => {
    const { token } = await login(
      Manager.RegularOrganization.email,
      Manager.RegularOrganization.password
    );
    const orgSlug = Manager.RegularOrganization.orgSlug;

    const response = await request(app)
      .post(`/api/${orgSlug}/admin/users/invite`)
      .set('Authorization', `Bearer: ${token}`)
      .send({
        email: 'learner@unspecified.com',
        role: 'Learner'
        // organization  // Unspecified organization
      });

    expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
  });

  it('Cannot invite to non-existent organizations', async () => {
    const { token } = await login(
      Manager.RegularOrganization.email,
      Manager.RegularOrganization.password
    );
    const orgSlug = Manager.RegularOrganization.orgSlug;

    const response = await request(app)
      .post(`/api/${orgSlug}/admin/users/invite`)
      .set('Authorization', `Bearer: ${token}`)
      .send({
        email: 'learner@nonexistent.com',
        role: 'Learner',
        organization: 'Non-existent Organization'
      });

    expect(response.status).toEqual(StatusCodes.NOT_FOUND);
    expect(response.body.message).toEqual(
      'Organization to invite user to does not exist'
    );
  });

  it('Cannot invite to unmanaged organizations', async () => {
    const { token } = await login(
      Manager.RegularOrganization.email,
      Manager.RegularOrganization.password
    );
    const orgSlug = Manager.RegularOrganization.orgSlug;

    const response = await request(app)
      .post(`/api/${orgSlug}/admin/users/invite`)
      .set('Authorization', `Bearer: ${token}`)
      .send({
        email: 'learner@org3.com',
        role: 'Learner',
        organization: 'Org 3'
      });

    expect(response.status).toEqual(StatusCodes.FORBIDDEN);
    expect(response.body.message).toEqual(
      'Only managers can invite to organizations'
    );
  });

  describe('Regular organizations', () => {
    it('Cannot invite as public users', async () => {
      const { token } = await login(
        Manager.RegularOrganization.email,
        Manager.RegularOrganization.password
      );
      const orgSlug = Manager.RegularOrganization.orgSlug;

      const response = await request(app)
        .post(`/api/${orgSlug}/admin/users/invite`)
        .set('Authorization', `Bearer: ${token}`)
        .send({
          email: 'public@user.com',
          role: 'Learner', // Should fail for any role
          organization: organizationConfig.PUBLIC_ORGANIZATION_NAME
        });

      expect(response.status).toEqual(StatusCodes.FORBIDDEN);
      expect(response.body.message).toEqual(
        'Only managers can invite to organizations'
      );
    });

    it('Cannot invite users as super admin', async () => {
      await expectSuperAdminFailure(
        {
          email: Manager.RegularOrganization.email,
          password: Manager.RegularOrganization.password,
          orgSlug: Manager.RegularOrganization.orgSlug
        },
        {
          email: 'invited.superadmin@org1.com',
          role: 'Super Admin',
          organization: 'Org 1'
        }
      );
    });

    it('Can invite users as admins', async () => {
      await expectInviteSuccess(
        {
          email: Manager.RegularOrganization.email,
          password: Manager.RegularOrganization.password,
          orgSlug: Manager.RegularOrganization.orgSlug
        },
        {
          email: 'invited.admin@org1.com',
          role: 'Admin',
          organization: 'Org 1'
        }
      );
    });

    it('Can invite users as trainers', async () => {
      await expectInviteSuccess(
        {
          email: Manager.RegularOrganization.email,
          password: Manager.RegularOrganization.password,
          orgSlug: Manager.RegularOrganization.orgSlug
        },
        {
          email: 'invited.trainer@org1.com',
          role: 'Trainer',
          organization: 'Org 1'
        }
      );
    });

    it('Can invite users as learners', async () => {
      await expectInviteSuccess(
        {
          email: Manager.RegularOrganization.email,
          password: Manager.RegularOrganization.password,
          orgSlug: Manager.RegularOrganization.orgSlug
        },
        {
          email: 'invited.learner@org1.com',
          role: 'Learner',
          organization: 'Org 1'
        }
      );
    });
  });

  describe('System organization', () => {
    it('Can invite as public users', async () => {
      await expectInviteSuccess(
        {
          email: Manager.System.email,
          password: Manager.System.password,
          orgSlug: Manager.RegularOrganization.orgSlug
        },
        {
          email: 'user@public.com',
          role: 'Learner', // Should succeed for any role
          organization: organizationConfig.PUBLIC_ORGANIZATION_NAME
        }
      );
    });

    it('Cannot invite users as super admin', async () => {
      await expectSuperAdminFailure(
        {
          email: Manager.System.email,
          password: Manager.System.password,
          orgSlug: Manager.RegularOrganization.orgSlug
        },
        {
          email: 'superadmin@system.com',
          role: 'Super Admin',
          organization: organizationConfig.SYSTEM_ORGANIZATION_NAME
        }
      );
    });

    it('Can invite users as admins', async () => {
      await expectInviteSuccess(
        {
          email: Manager.System.email,
          password: Manager.System.password,
          orgSlug: Manager.System.orgSlug
        },
        {
          email: 'administrator@system.com',
          role: 'Admin',
          organization: organizationConfig.SYSTEM_ORGANIZATION_NAME
        }
      );
    });

    it('Cannot invite users as trainers', async () => {
      const { token } = await login(
        Manager.System.email,
        Manager.System.password
      );
      const orgSlug = Manager.System.orgSlug;

      const response = await request(app)
        .post(`/api/${orgSlug}/admin/users/invite`)
        .set('Authorization', `Bearer: ${token}`)
        .send({
          email: 'trainer@system.com',
          role: 'Trainer',
          organization: organizationConfig.SYSTEM_ORGANIZATION_NAME
        });

      expect(response.status).toEqual(StatusCodes.FORBIDDEN);
      expect(response.body.message).toEqual(
        'Cannot invite trainers to system organization'
      );
    });

    it('Cannot invite users as learners', async () => {
      const { token } = await login(
        Manager.System.email,
        Manager.System.password
      );
      const orgSlug = Manager.System.orgSlug;

      const response = await request(app)
        .post(`/api/${orgSlug}/admin/users/invite`)
        .set('Authorization', `Bearer: ${token}`)
        .send({
          email: 'learner@system.com',
          role: 'Learner',
          organization: organizationConfig.SYSTEM_ORGANIZATION_NAME
        });

      expect(response.status).toEqual(StatusCodes.FORBIDDEN);
      expect(response.body.message).toEqual(
        'Cannot invite learners to system organization'
      );
    });
  });

  describe('Public', () => {
    it('Cannot invite users as super admin', async () => {
      await expectSuperAdminFailure(
        {
          email: Manager.Public.email,
          password: Manager.Public.password,
          orgSlug: Manager.Public.orgSlug
        },
        {
          email: 'superadmin@public.com',
          role: 'Super Admin',
          organization: organizationConfig.PUBLIC_ORGANIZATION_NAME
        }
      );
    });

    it('Can invite users as admins', async () => {
      await expectInviteSuccess(
        {
          email: Manager.Public.email,
          password: Manager.Public.password,
          orgSlug: Manager.Public.orgSlug
        },
        {
          email: 'admin@public.com',
          role: 'Admin',
          organization: organizationConfig.PUBLIC_ORGANIZATION_NAME
        }
      );
    });

    it('Can invite users as trainers', async () => {
      await expectInviteSuccess(
        {
          email: Manager.Public.email,
          password: Manager.Public.password,
          orgSlug: Manager.Public.orgSlug
        },
        {
          email: 'trainer@public.com',
          role: 'Trainer',
          organization: organizationConfig.PUBLIC_ORGANIZATION_NAME
        }
      );
    });

    it('Can invite users as learners', async () => {
      await expectInviteSuccess(
        {
          email: Manager.Public.email,
          password: Manager.Public.password,
          orgSlug: Manager.Public.orgSlug
        },
        {
          email: 'learner@public.com',
          role: 'Learner',
          organization: organizationConfig.PUBLIC_ORGANIZATION_NAME
        }
      );
    });
  });

  describe('Invitations to existing users', () => {
    it('Cannot invite to organization if already a member', async () => {
      const { token } = await login(
        Manager.RegularOrganization.email,
        Manager.RegularOrganization.password
      );
      const orgSlug = Manager.RegularOrganization.orgSlug;

      const response = await request(app)
        .post(`/api/${orgSlug}/admin/users/invite`)
        .set('Authorization', `Bearer: ${token}`)
        .send({
          email: 'learner@org1.com',
          role: 'Learner',
          organization: 'Org 1'
        });

      expect(response.status).toEqual(StatusCodes.CONFLICT);
      expect(response.body.message).toEqual(
        'User is already member of given organization'
      );
    });

    it('Can invite to different organization', async () => {
      await expectInviteSuccess(
        {
          email: Manager.RegularOrganization.email,
          password: Manager.RegularOrganization.password,
          orgSlug: Manager.RegularOrganization.orgSlug
        },
        {
          email: 'newlearner@org2.com',
          role: 'Learner',
          organization: 'Org 1'
        }
      );
    });

    it('Can invite public users into organization', async () => {
      await expectInviteSuccess(
        {
          email: Manager.RegularOrganization.email,
          password: Manager.RegularOrganization.password,
          orgSlug: Manager.RegularOrganization.orgSlug
        },
        {
          email: 'approved.learner@user.com',
          role: 'Learner',
          organization: 'Org 1'
        }
      );
    });
  });

  describe('Membership acceptance', () => {
    it('Should be not accepted for invited existing users', async () => {
      const email = 'newlearner@org3.com';

      await expectInviteSuccess(
        {
          email: Manager.RegularOrganization.email,
          password: Manager.RegularOrganization.password,
          orgSlug: Manager.RegularOrganization.orgSlug
        },
        {
          email,
          role: 'Learner',
          organization: 'Org 1'
        }
      );

      const userDoc = await User.findOne({ email })
        .populate('organizations.organization')
        .lean();
      const invitedMembership = userDoc?.organizations?.find((org) =>
        org.organization._id.equals(ID['Org 1'])
      );

      expect(invitedMembership?.is_accepted).toEqual(false);
    });
  });

  /**
   * Should probably test invitation token payload, but not easily able to
   * because it is sent directly to the mail service as part of invitation link
   *
   * It is possible to intercept the mail service request, however
   * invitation link is in HTML body that needs to be parsed and searched
   */
  describe.skip('Invitation token', () => {
    it('Should always have email and role', async () => {});
    it('Should have organization ID for organization invites', async () => {});
    it('Should not have organization ID for public invites', async () => {});
  });
});

describe('Accounts access', () => {
  it('Has specific response for public organization members', async () => {
    const email = 'approved.admin@user.com';
    const password = 'Approved1-Admin';
    const orgSlug = 'public';
    const expectedAccess = 'public';

    const { token } = await login(email, password);
    const response = await request(app)
      .get(`/api/${orgSlug}/admin/users/accounts/access`)
      .set('Authorization', `Bearer: ${token}`);

    expect(response?.body?.data?.access).toEqual(expectedAccess);
  });

  it('Has specific response for system organization members', async () => {
    const email = 'admin1@system.com';
    const password = 'Admin1-System';
    const orgSlug = 'system';
    const expectedAccess = 'system';

    const { token } = await login(email, password);
    const response = await request(app)
      .get(`/api/${orgSlug}/admin/users/accounts/access`)
      .set('Authorization', `Bearer: ${token}`);

    expect(response?.body?.data?.access).toEqual(expectedAccess);
  });

  it('Has specific response for organization owners', async () => {
    const email = 'owner@org1.com';
    const password = 'Owner1-Org1';
    const orgSlug = 'org-1';
    const expectedAccess = 'organization-owner';

    const { token } = await login(email, password);
    const response = await request(app)
      .get(`/api/${orgSlug}/admin/users/accounts/access`)
      .set('Authorization', `Bearer: ${token}`);

    expect(response?.body?.data?.access).toEqual(expectedAccess);
  });

  it('Has specific response for organization members', async () => {
    const email = 'admin@org1.com';
    const password = 'Admin1-Org1';
    const orgSlug = 'org-1';
    const expectedAccess = 'organization';

    const { token } = await login(email, password);
    const response = await request(app)
      .get(`/api/${orgSlug}/admin/users/accounts/access`)
      .set('Authorization', `Bearer: ${token}`);

    expect(response?.body?.data?.access).toEqual(expectedAccess);
  });
});
