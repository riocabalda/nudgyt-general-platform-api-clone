import request from 'supertest';
import z from 'zod';
import app from '../../src/app';

export async function login(email: string, password: string) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });

  const token = z.string().parse(response.body.data.token);

  return { response, token };
}
