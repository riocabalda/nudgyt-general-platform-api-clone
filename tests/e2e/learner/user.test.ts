import request from 'supertest';
import app from '../../../src/app';
import { setupMemoryDb } from '../../utils/db';
import { login } from '../../utils/login';

setupMemoryDb();

describe('Accounts access', () => {
  /** Logic not yet implemented for this case yet */
  it.skip('Has specific response for paid public organization members', async () => {
    const email = 'approved.learner@user.com';
    const password = 'Approved1-Learner';
    const orgSlug = 'public';
    const expectedAccess = 'public-paid';

    const { token } = await login(email, password);
    const response = await request(app)
      .get(`/api/${orgSlug}/learner/users/accounts/access`)
      .set('Authorization', `Bearer: ${token}`);

    expect(response?.body?.data?.access).toEqual(expectedAccess);
  });

  it('Has specific response for public organization members', async () => {
    const email = 'approved.learner@user.com';
    const password = 'Approved1-Learner';
    const orgSlug = 'public';
    const expectedAccess = 'public';

    const { token } = await login(email, password);
    const response = await request(app)
      .get(`/api/${orgSlug}/learner/users/accounts/access`)
      .set('Authorization', `Bearer: ${token}`);

    expect(response?.body?.data?.access).toEqual(expectedAccess);
  });

  it('Has specific response for organization members', async () => {
    const email = 'learner@org1.com';
    const password = 'Learner1-Org1';
    const orgSlug = 'org-1';
    const expectedAccess = 'organization';

    const { token } = await login(email, password);
    const response = await request(app)
      .get(`/api/${orgSlug}/learner/users/accounts/access`)
      .set('Authorization', `Bearer: ${token}`);

    expect(response?.body?.data?.access).toEqual(expectedAccess);
  });
});
