import { StatusCodes } from 'http-status-codes';
import request from 'supertest';
import app from '../../../src/app';
import { setupMemoryDb } from '../../utils/db';
import { login } from '../../utils/login';

setupMemoryDb();

describe('Display info', () => {
  it('Cannot be accessed by non-members', async () => {
    const email = 'approved.learner@user.com';
    const password = 'Approved1-Learner';
    const orgSlug = 'org-1'; // Not a member of this organization

    const { token } = await login(email, password);
    const response = await request(app)
      .get(`/api/${orgSlug}/learner/organizations/display-info`)
      .set('Authorization', `Bearer: ${token}`);

    expect(response.status).toEqual(StatusCodes.UNAUTHORIZED);
  });

  const TEST_DATA = [
    {
      description: 'Gives no info for public learners',
      email: 'approved.learner@user.com',
      password: 'Approved1-Learner',
      orgSlug: 'public',
      expectedName: undefined,
      expectedCode: undefined
    },
    {
      description: 'Gives only name for organization learners',
      email: 'learner@org1.com',
      password: 'Learner1-Org1',
      orgSlug: 'org-1',
      expectedName: 'Org 1',
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
        .get(`/api/${orgSlug}/learner/organizations/display-info`)
        .set('Authorization', `Bearer: ${token}`);

      expect(response.body.data.name).toEqual(expectedName);
      expect(response.body.data.code).toEqual(expectedCode);
    });
  }
});
