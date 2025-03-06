import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import z from 'zod';
import app from '../../src/app';
import organizationConfig from '../../src/config/organization.config';
import Organization from '../../src/models/organization.model';
import User from '../../src/models/user.model';
import encryptionService from '../../src/services/encryption.service';
import { ID, setupMemoryDb } from '../utils/db';
import { withMockMail } from '../utils/interceptors';
import { login } from '../utils/login';

setupMemoryDb();

describe('Update password', () => {
  const TestUser = {
    Email: 'approved.learner@user.com',
    Password: 'Approved1-Learner',
    PasswordHash: ''
  };

  function composeBody(args?: {
    password?: string;
    confirm_password?: string;
    current_password?: string;
  }) {
    return {
      password: args?.password ?? 'New1-Password',
      confirm_password: args?.confirm_password ?? 'New1-Password',
      current_password: args?.current_password ?? TestUser.Password
    };
  }

  async function storeOriginalPassword() {
    const testUserDoc = await User.findOne({ email: TestUser.Email });
    if (testUserDoc === null) {
      throw new Error('Cannot find test user in database');
    }

    TestUser.PasswordHash = testUserDoc.password;
  }

  async function restoreOriginalPassword() {
    await User.findOneAndUpdate(
      { email: TestUser.Email },
      { password: TestUser.PasswordHash }
    );
  }

  beforeAll(async () => {
    await storeOriginalPassword();
  });

  afterEach(async () => {
    await restoreOriginalPassword();
  });

  it('Fails without current password', async () => {
    const { token } = await login(TestUser.Email, TestUser.Password);

    const { current_password, ...body } = composeBody();
    const response = await request(app)
      .patch('/api/auth/update-password')
      .set('Authorization', `Bearer: ${token}`)
      .send(body);

    const ResponseSchema = z.object({
      statusCode: z.literal(StatusCodes.BAD_REQUEST),
      body: z.tuple([
        z.object({
          type: z.literal('Body'),
          errors: z.object({
            issues: z.tuple([
              z.object({
                message: z.literal('Required'),
                path: z.tuple([z.literal('current_password')])
              })
            ])
          })
        })
      ])
    });

    const { data: parsedResponse, error } =
      ResponseSchema.safeParse(response);
    if (error !== undefined) {
      console.error(error);
    }

    expect(parsedResponse).toBeDefined();
  });

  it('Fails with incorrect password', async () => {
    const { token } = await login(TestUser.Email, TestUser.Password);

    const response = await request(app)
      .patch('/api/auth/update-password')
      .set('Authorization', `Bearer: ${token}`)
      .send(
        composeBody({
          current_password: 'Incorrect1-Password'
        })
      );

    const ResponseSchema = z.object({
      statusCode: z.literal(StatusCodes.BAD_REQUEST),
      body: z.object({
        message: z.literal('Incorrect password')
      })
    });

    const { data: parsedResponse, error } =
      ResponseSchema.safeParse(response);
    if (error !== undefined) {
      console.error(error);
    }

    expect(parsedResponse).toBeDefined();
  });

  it('Fails with mismatching passwords', async () => {
    const { token } = await login(TestUser.Email, TestUser.Password);

    const response = await request(app)
      .patch('/api/auth/update-password')
      .set('Authorization', `Bearer: ${token}`)
      .send(
        composeBody({
          password: 'One1-Password',
          confirm_password: 'Another1-Password'
        })
      );

    const ResponseSchema = z.object({
      statusCode: z.literal(StatusCodes.BAD_REQUEST)
    });

    const { data: parsedResponse, error } =
      ResponseSchema.safeParse(response);
    if (error !== undefined) {
      console.error(error);
    }

    expect(parsedResponse).toBeDefined();
  });

  it('Succeeds with valid inputs', async () => {
    const { token } = await login(TestUser.Email, TestUser.Password);

    const response = await request(app)
      .patch('/api/auth/update-password')
      .set('Authorization', `Bearer: ${token}`)
      .send(composeBody());

    const ResponseSchema = z.object({
      body: z.object({
        message: z.literal('Password changed successfully.')
      })
    });

    const { data: parsedResponse, error } =
      ResponseSchema.safeParse(response);
    if (error !== undefined) {
      console.error(error);
    }

    expect(parsedResponse).toBeDefined();

    const userDoc = await User.findOne({ email: TestUser.Email });
    const passwordHash = userDoc?.password;
    const areHashesDifferent = passwordHash !== TestUser.PasswordHash;

    expect(areHashesDifferent).toEqual(true);
  });
});

describe('Register', () => {
  const DefaultCredentials = {
    email: 'learner@signup.com',
    password: 'Learner1-Signup'
  };

  function signUpDetails(args?: {
    full_name?: string;
    email?: string;
    organization_name?: string;
    organization_code?: string;
    password?: string;
    confirm_password?: string;
    role?: string;
    invitation_token?: string;
    isTermsAndConditionsAccepted?: boolean;
  }) {
    return {
      full_name: args?.full_name ?? 'Learner Sign-up',
      email: args?.email ?? DefaultCredentials.email,
      organization_name: args?.organization_name ?? null,
      organization_code: args?.organization_code ?? null,
      password: args?.password ?? DefaultCredentials.password,
      confirm_password:
        args?.confirm_password ?? DefaultCredentials.password,
      role: args?.role ?? 'Learner',
      invitation_token: args?.invitation_token ?? undefined,
      isTermsAndConditionsAccepted:
        args?.isTermsAndConditionsAccepted ?? true
    };
  }

  describe('Regular sign-up', () => {
    it('Cannot register with mismatching passwords', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            password: 'Some1-Password',
            confirm_password: 'Another1-Password'
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Cannot register without accepting terms and conditions', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            isTermsAndConditionsAccepted: false
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Cannot register if already existing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            email: 'approved.learner@user.com'
          })
        );

      expect(response.status).toEqual(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(response.body.message).toEqual(
        'This email has already been taken.'
      );
    });

    it('Cannot register as super admin', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            role: 'Super Admin'
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Cannot register as admin', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            role: 'Admin'
          })
        );

      expect(response.status).toEqual(StatusCodes.FORBIDDEN);
      expect(response.body.message).toEqual(
        'Cannot sign up as uninvited admin'
      );
    });

    describe('Organizations', () => {
      const email = 'org@register.com';

      afterEach(async () => {
        /** Clean-up registration */
        await User.deleteOne({ email });
      });

      it('Cannot register as existing organization', async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              role: 'Organization',
              organization_name: 'Org 1' // Existing organization
            })
          );

        expect(response.status).toEqual(StatusCodes.CONFLICT);
        expect(response.body.message).toEqual(
          'Organization name already exists'
        );
      });

      it('Cannot register with colliding organization name slug', async () => {
        /**
         * This produces a kebab-case value of `org-1`,
         * which collides with the kebab-case value of `Org 1`,
         * which should be an existing organization.
         *
         * Such cases should also be considered as an existing organization
         */
        const orgNameWithCollidingSlug = 'Org & 1';

        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              role: 'Organization',
              organization_name: orgNameWithCollidingSlug
            })
          );

        expect(response.status).toEqual(StatusCodes.CONFLICT);
        expect(response.body.message).toEqual(
          'Organization name already exists'
        );
      });

      it('Can register as new organization', async () => {
        await withMockMail(async () => {
          const response = await request(app)
            .post('/api/auth/register')
            .send(
              signUpDetails({
                email,
                role: 'Organization',
                organization_name: 'New Org'
              })
            );
          expect(response.status).toEqual(StatusCodes.CREATED);
          expect(response.body.message).toEqual(
            'User registered successfully.'
          );

          const doc = await User.findOne({ email }).lean();

          const memberships = doc?.organizations ?? [];
          expect(memberships.length).toEqual(1);

          const orgMembership = memberships[0];
          expect(orgMembership.roles[0]).toEqual('Admin');
          expect(orgMembership.is_owner).toEqual(true);
        });
      });

      it('Has organization slug', async () => {
        await withMockMail(async () => {
          const orgName = 'Pixel-Perfect & Creatives';
          const expectedSlug = 'pixel-perfect-creatives';

          const response = await request(app)
            .post('/api/auth/register')
            .send(
              signUpDetails({
                email,
                role: 'Organization',
                organization_name: orgName
              })
            );
          expect(response.ok).toEqual(true);

          const orgDoc = await Organization.findOne({ name: orgName });
          expect(orgDoc?.slug).toEqual(expectedSlug);
        });
      });

      it('Has organization code', async () => {
        await withMockMail(async () => {
          const orgName = 'Organization With Code';

          const response = await request(app)
            .post('/api/auth/register')
            .send(
              signUpDetails({
                email,
                role: 'Organization',
                organization_name: orgName
              })
            );
          expect(response.ok).toEqual(true);

          const orgDoc = await Organization.findOne({ name: orgName });
          const { data: code } = z
            .string()
            .min(1)
            .safeParse(orgDoc?.code);
          expect(code).toBeDefined();
        });
      });
    });

    it('Can register as new trainer', async () => {
      await withMockMail(async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email: 'trainer@register.com',
              role: 'Trainer'
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });
    });

    it('Can register as new learner', async () => {
      await withMockMail(async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email: 'learner@register.com',
              role: 'Learner'
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });
    });

    it('Should have accepted membership', async () => {
      const email = 'another.learner@register.com';

      await withMockMail(async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email,
              role: 'Learner'
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });

      const userDoc = await User.findOne({ email })
        .populate('organizations.organization')
        .lean();
      const membership = userDoc?.organizations?.find((org) =>
        org.organization._id.equals(ID.PublicOrg)
      );

      expect(membership?.is_accepted).toEqual(true);
    });
  });

  describe('Regular sign-up with organization code', () => {
    it('Cannot register with non-existent code', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            organization_code: '123456' // Non-existent
          })
        );

      expect(response.status).toEqual(StatusCodes.NOT_FOUND);
      expect(response.body.message).toEqual(
        'Organization does not exist'
      );
    });

    it('Cannot register with organization name', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            organization_code: 'AF816D', // Code for "Org 2"
            organization_name: 'Org 1' // Value should not matter
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toEqual(
        'Cannot register with both organization name and code'
      );
    });

    it('Cannot register with invitation token', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            organization_code: 'AF816D',
            /** Generic JWT from https://en.wikipedia.org/wiki/JSON_Web_Token */
            invitation_token:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dnZWRJbkFzIjoiYWRtaW4iLCJpYXQiOjE0MjI3Nzk2Mzh9.gzSraSYS8EXBxLN _oWnFSRgCzcmJmMjLiuyu5CSpyHI='
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toEqual(
        'Cannot register with both organization code and invitation token'
      );
    });

    it('Cannot register with existing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            organization_code: 'AF816D',
            email: 'approved.learner@user.com'
          })
        );

      expect(response.status).toEqual(StatusCodes.CONFLICT);
      expect(response.body.message).toEqual(
        'Existing account, join organization'
      );
    });

    it('Can register as new learner', async () => {
      await withMockMail(async () => {
        const email = 'learner.with.code@register.com';
        const expectedCode = 'AF816D';

        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              organization_code: expectedCode,
              email,
              role: 'Learner'
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );

        const userDoc = await User.findOne({ email })
          .populate('organizations.organization')
          .lean();

        const memberships = userDoc?.organizations;
        const hasExpectedCode =
          memberships?.some(
            (membership) =>
              membership.organization.code === expectedCode
          ) ?? false;

        const isEmailVerified =
          (userDoc?.email_verified_at ?? null) !== null;
        const isApproved = (userDoc?.approved_at ?? null) !== null;

        expect(memberships?.length).toEqual(1);
        expect(hasExpectedCode).toEqual(true);

        /** Must still be for approval */
        expect(isEmailVerified).toEqual(false);
        expect(isApproved).toEqual(false);
      });
    });
  });

  describe('Invitation', () => {
    it('Cannot register with invalid invitation token', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            /** Generic JWT from https://en.wikipedia.org/wiki/JSON_Web_Token */
            invitation_token:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2dnZWRJbkFzIjoiYWRtaW4iLCJpYXQiOjE0MjI3Nzk2Mzh9.gzSraSYS8EXBxLN _oWnFSRgCzcmJmMjLiuyu5CSpyHI='
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toEqual(
        'The invitation link is invalid.'
      );
    });

    it('Cannot register with expired invitation token', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            /** "Empty" JWT, signed by app, with expiration info */
            invitation_token:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MzM0NzM0NDYsImV4cCI6MTczMzQ2OTg0Nn0.j_kzD8WaRLUBBVu3_1H63h4tIEh4p5EWJoOHUc8VaPw'
          })
        );

      expect(response.status).toEqual(StatusCodes.UNPROCESSABLE_ENTITY);
      expect(response.body.message).toEqual(
        'The invitation link has expired.'
      );
    });

    it('Cannot register with mismatching invitation token email data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            email: 'correct@email.com',
            role: 'Learner',
            invitation_token: encryptionService.generateToken({
              payload: {
                email: 'incorrect@email.com', // Incorrect
                role: 'Learner'
              }
            })
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Cannot register with mismatching invitation token role data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            email: 'correct@email.com',
            role: 'Learner',
            invitation_token: encryptionService.generateToken({
              payload: {
                email: 'correct@email.com',
                role: 'Incorrect Role' // Incorrect
              }
            })
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Cannot register as invited super admin', async () => {
      const email = 'invited.superadmin@register.com';
      const role = 'Super Admin';

      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            email,
            role,
            invitation_token: encryptionService.generateToken({
              payload: { email, role }
            })
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Can register as invited admin', async () => {
      await withMockMail(async () => {
        const email = 'invited.admin@register.com';
        const role = 'Admin';

        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email,
              role,
              invitation_token: encryptionService.generateToken({
                payload: { email, role, organization_id: ID.PublicOrg }
              })
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });
    });

    it('Can register as invited trainer', async () => {
      await withMockMail(async () => {
        const email = 'invited.trainer@register.com';
        const role = 'Trainer';

        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email,
              role,
              invitation_token: encryptionService.generateToken({
                payload: { email, role, organization_id: ID.PublicOrg }
              })
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });
    });

    it('Can register as invited learner', async () => {
      await withMockMail(async () => {
        const email = 'invited.learner@register.com';
        const role = 'Learner';

        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email,
              role,
              invitation_token: encryptionService.generateToken({
                payload: { email, role, organization_id: ID.PublicOrg }
              })
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });
    });

    it('Should have accepted membership', async () => {
      const email = 'another.invited.learner@register.com';

      await withMockMail(async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email,
              role: 'Learner'
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });

      const userDoc = await User.findOne({ email })
        .populate('organizations.organization')
        .lean();
      const membership = userDoc?.organizations?.find((org) =>
        org.organization._id.equals(ID.PublicOrg)
      );

      expect(membership?.is_accepted).toEqual(true);
    });
  });

  describe('Organization invites', () => {
    it('Cannot register to non-existent organization', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            organization_name: 'Non-existent Organization'
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
      expect(response.body.message).toEqual(
        'Organization info not available'
      );
    });

    it('Cannot register with non-existent organization in invitation token', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            email: 'correct@email.com',
            role: 'Learner',
            organization_name: 'Org 1',
            invitation_token: encryptionService.generateToken({
              payload: {
                email: 'correct@email.com',
                role: 'Learner',
                organization_id: ID.NonExistentOrg
              }
            })
          })
        );

      expect(response.status).toEqual(StatusCodes.NOT_FOUND);
      expect(response.body.message).toEqual(
        'Inviting organization does not exist'
      );
    });

    it('Cannot register with mismatching invitation token organization data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            email: 'correct@email.com',
            role: 'Learner',
            organization_name: 'Org 1',
            invitation_token: encryptionService.generateToken({
              payload: {
                email: 'correct@email.com',
                role: 'Learner',
                organization_id: ID['Org 2'] // Exists, but not 'Org 1'
              }
            })
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Cannot register to organization as super admin', async () => {
      const email = 'invited.superadmin@org.com';
      const role = 'Super Admin';

      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            email,
            role,
            organization_name: 'Org 1',
            invitation_token: encryptionService.generateToken({
              payload: { email, role, organization_id: ID['Org 1'] }
            })
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    it('Can register to organization as admin', async () => {
      await withMockMail(async () => {
        const email = 'invited.admin@org.com';
        const role = 'Admin';

        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email,
              role,
              organization_name: 'Org 1',
              invitation_token: encryptionService.generateToken({
                payload: { email, role, organization_id: ID['Org 1'] }
              })
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });
    });

    it('Can register to organization as trainer', async () => {
      await withMockMail(async () => {
        const email = 'invited.trainer@org.com';
        const role = 'Trainer';

        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email,
              role,
              organization_name: 'Org 1',
              invitation_token: encryptionService.generateToken({
                payload: { email, role, organization_id: ID['Org 1'] }
              })
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });
    });

    it('Can register to organization as learner', async () => {
      await withMockMail(async () => {
        const email = 'invited.learner@org.com';
        const role = 'Learner';

        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email,
              role,
              organization_name: 'Org 1',
              invitation_token: encryptionService.generateToken({
                payload: { email, role, organization_id: ID['Org 1'] }
              })
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });
    });

    it('Should have accepted membership', async () => {
      const email = 'another.invited.learner@org.com';
      const role = 'Learner';

      await withMockMail(async () => {
        const response = await request(app)
          .post('/api/auth/register')
          .send(
            signUpDetails({
              email,
              role,
              organization_name: 'Org 1',
              invitation_token: encryptionService.generateToken({
                payload: { email, role, organization_id: ID['Org 1'] }
              })
            })
          );

        expect(response.status).toEqual(StatusCodes.CREATED);
        expect(response.body.message).toEqual(
          'User registered successfully.'
        );
      });

      const userDoc = await User.findOne({ email })
        .populate('organizations.organization')
        .lean();
      const membership = userDoc?.organizations?.find((org) =>
        org.organization._id.equals(ID['Org 1'])
      );

      expect(membership?.is_accepted).toEqual(true);
    });
  });

  describe('System organization invites', () => {
    it('Cannot register to system organization as super admin', async () => {
      const email = 'invited.superadmin@system.com';
      const role = 'Super Admin';

      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            email,
            role,
            organization_name:
              organizationConfig.SYSTEM_ORGANIZATION_NAME,
            invitation_token: encryptionService.generateToken({
              payload: { email, role, organization_id: ID.SystemOrg }
            })
          })
        );

      expect(response.status).toEqual(StatusCodes.BAD_REQUEST);
    });

    describe('Invited system admins', () => {
      const email = 'invited.admin@system.com';
      const password = 'Invited1-Admin';
      const role = 'Admin';

      const details = signUpDetails({
        email,
        password,
        confirm_password: password,
        role,
        organization_name: organizationConfig.SYSTEM_ORGANIZATION_NAME,
        invitation_token: encryptionService.generateToken({
          payload: {
            email,
            role,
            organization_id: ID.SystemOrg
          }
        })
      });

      afterEach(async () => {
        /** Clean-up registration */
        await User.deleteOne({ email });
      });

      it('Can register to system organization as admin', async () => {
        await withMockMail(async () => {
          const response = await request(app)
            .post('/api/auth/register')
            .send(details);

          expect(response.status).toEqual(StatusCodes.CREATED);
          expect(response.body.message).toEqual(
            'User registered successfully.'
          );
        });
      });

      it('Is an admin of the public organization', async () => {
        /** Create user */
        await withMockMail(async () => {
          const response = await request(app)
            .post('/api/auth/register')
            .send(details);

          expect(response.ok).toEqual(true);
        });

        /**
         * Directly get user data
         *
         * Should this be done through the API routes as well?
         * Might be too much...
         */
        const userDoc = await User.findOne({ email })
          .populate('organizations.organization')
          .lean();
        const publicOrgMembership = userDoc?.organizations?.find(
          (org) => org.organization._id.equals(ID.PublicOrg)
        );

        expect(publicOrgMembership).not.toEqual(undefined);
        expect(publicOrgMembership?.roles[0]).toEqual('Admin');
      });

      it('Should have accepted membership', async () => {
        await withMockMail(async () => {
          const response = await request(app)
            .post('/api/auth/register')
            .send(details);

          expect(response.status).toEqual(StatusCodes.CREATED);
          expect(response.body.message).toEqual(
            'User registered successfully.'
          );
        });

        const userDoc = await User.findOne({ email })
          .populate('organizations.organization')
          .lean();
        const membership = userDoc?.organizations?.find((org) =>
          org.organization._id.equals(ID.SystemOrg)
        );

        expect(membership?.is_accepted).toEqual(true);
      });
    });

    it('Cannot register to system organization as trainer', async () => {
      const email = 'invited.trainer@system.com';
      const role = 'Trainer';

      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            email,
            role,
            organization_name:
              organizationConfig.SYSTEM_ORGANIZATION_NAME,
            invitation_token: encryptionService.generateToken({
              payload: { email, role, organization_id: ID.SystemOrg }
            })
          })
        );

      expect(response.status).toEqual(StatusCodes.FORBIDDEN);
      expect(response.body.message).toEqual(
        'Cannot sign up to system organization as trainer'
      );
    });

    it('Cannot register to system organization as learner', async () => {
      const email = 'invited.learner@system.com';
      const role = 'Learner';

      const response = await request(app)
        .post('/api/auth/register')
        .send(
          signUpDetails({
            email,
            role,
            organization_name:
              organizationConfig.SYSTEM_ORGANIZATION_NAME,
            invitation_token: encryptionService.generateToken({
              payload: { email, role, organization_id: ID.SystemOrg }
            })
          })
        );

      expect(response.status).toEqual(StatusCodes.FORBIDDEN);
      expect(response.body.message).toEqual(
        'Cannot sign up to system organization as learner'
      );
    });
  });
});

describe('Login', () => {
  it('Should fail with no credentials', async () => {
    const response = await request(app).post('/api/auth/login');

    /** Response must NOT be OK */
    expect(response.ok).toBe(false);

    /** Must have expected error */
    const errorType = response.body[0].type;
    expect(errorType).toBe('Body');
  });

  it('Should fail with non-existent user', async () => {
    const email = 'nonexistent@user.com';
    const randomPassword = crypto.randomUUID();

    const response = await request(app).post('/api/auth/login').send({
      email,
      password: randomPassword
    });

    /** Response must NOT be OK */
    expect(response.ok).toBe(false);

    /** Must have expected message */
    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('Should fail with incorrect password', async () => {
    const email = 'approved.learner@user.com';
    const randomPassword = crypto.randomUUID();

    const response = await request(app).post('/api/auth/login').send({
      email,
      password: randomPassword
    });

    /** Response must NOT be OK */
    expect(response.ok).toBe(false);

    /** Must have expected message */
    expect(response.body.message).toBe('Invalid email or password.');
  });

  it('Should succeed with valid credentials', async () => {
    const email = 'approved.learner@user.com';

    const response = await request(app).post('/api/auth/login').send({
      email,
      password: 'Approved1-Learner'
    });

    /** Response must be OK */
    expect(response.ok).toBe(true);

    /** Must have expected message */
    expect(response.body.message).toBe('User logged in successfully.');

    /**
     * Must have non-empty token string
     *
     * Check if valid JWT?
     */
    const token = z.string().parse(response.body.data.token);
    expect(token).not.toBe('');

    /** Must have same email credentials */
    expect(response.body.data.user.email).toBe(email);

    /** Must NOT contain the password */
    expect(response.body.data.user).not.toHaveProperty('password');

    /** Must set refresh token cookie */
    const headerCookies = z
      .string()
      .array()
      .parse(response.headers['set-cookie']);
    const hasRefreshTokenCookie = headerCookies.some((cookie) =>
      cookie.includes('nudgyt-rtkn')
    );
    expect(hasRefreshTokenCookie).toBe(true);
  });

  it('Should respond with populated memberships', async () => {
    const email = 'superadmin@system.com';
    const password = 'SuperAdmin1-System';

    const response = await request(app).post('/api/auth/login').send({
      email,
      password
    });

    const ResponseBodySchema = z.object({
      data: z.object({
        user: z.object({
          /**
           * There are other fields on a user object and their memberships,
           * but organizations is most important for this test
           */
          organizations: z
            .object({
              organization: z.object({
                name: z.string(),
                slug: z.string(),
                code: z.never().optional() // Must not be sent as part of response!
              })
            })
            .array()
        })
      })
    });
    const body = ResponseBodySchema.parse(response.body);

    const memberships = body.data.user.organizations;
    expect(memberships.length).toBeGreaterThan(0);

    for (const membership of memberships) {
      /** Must not receive organization ID */
      expect(typeof membership.organization).not.toEqual('string');

      /**
       * There are other things that should be checked here,
       * e.g. if the organization object has expected fields,
       * but they are largely taken care of by the Zod parsing,
       * and the test would not reach this point if that fails.
       */
    }
  });
});

describe('Me', () => {
  it('Should fail with invalid token', async () => {
    const response = await request(app).get('/api/auth/me'); // No token

    /** Response must NOT be OK */
    expect(response.ok).toBe(false);

    /** Must have expected message */
    expect(response.body.message).toBe('Unauthorized');
  });

  it('Should succeed with valid token', async () => {
    const email = 'approved.learner@user.com';
    const password = 'Approved1-Learner';
    const { token } = await login(email, password);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer: ${token}`);

    /** Response must be OK */
    expect(response.ok).toBe(true);

    /** Must have expected message */
    expect(response.body.message).toBe('OK');

    /** Must have same email credentials */
    expect(response.body.data.email).toBe(email);

    /** Must NOT contain the password */
    expect(response.body.data).not.toHaveProperty('password');
  });

  it('Should respond with populated memberships', async () => {
    const email = 'superadmin@system.com';
    const password = 'SuperAdmin1-System';
    const { token } = await login(email, password);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer: ${token}`);

    const ResponseBodySchema = z.object({
      message: z.literal('OK'),
      data: z.object({
        /**
         * There are other fields on a user object and their memberships,
         * but organizations is most important for this test
         */
        organizations: z
          .object({
            organization: z.object({
              name: z.string(),
              slug: z.string(),
              code: z.never().optional() // Must not be sent as part of response!
            })
          })
          .array()
      })
    });
    const body = ResponseBodySchema.parse(response.body);

    const memberships = body.data.organizations;
    expect(memberships.length).toBeGreaterThan(0);

    for (const membership of memberships) {
      /** Must not receive organization ID */
      expect(typeof membership.organization).not.toEqual('string');

      /**
       * There are other things that should be checked here,
       * e.g. if the organization object has expected fields,
       * but they are largely taken care of by the Zod parsing,
       * and the test would not reach this point if that fails.
       */
    }
  });
});
