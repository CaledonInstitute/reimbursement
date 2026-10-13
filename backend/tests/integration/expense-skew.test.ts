import { describe, it, expect, beforeAll } from 'vitest';
import * as supertestMod from 'supertest';
const request = ((supertestMod as any).default ?? supertestMod) as typeof import('supertest')['default'];
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { USERS, seedUser, auth, API } from '../helpers';

describe('expenseDate clock-skew tolerance (regression)', () => {
  let employee: any;

  beforeAll(async () => {
    employee = await seedUser(prisma, { name: 'Skew Emp', email: 'skew.emp@test.local', password: 'password123', role: 'EMPLOYEE' });
  });

  it('expenseDate +5 menit (dalam toleransi skew) diterima', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements`)
      .set(auth(employee))
      .send({
        description: 'Skew test', category: 'Transportasi', amount: 100000,
        expenses: [{ category: 'Transportasi', amount: 100000, expenseDate: new Date(Date.now() + 5 * 60 * 1000).toISOString(), description: 'Skew test' }],
      });
    expect(res.status).toBe(201);
  });

  it('expenseDate +1 jam (beneran masa depan) ditolak', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements`)
      .set(auth(employee))
      .send({
        description: 'Future test', category: 'Transportasi', amount: 100000,
        expenses: [{ category: 'Transportasi', amount: 100000, expenseDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(), description: 'Future test' }],
      });
    expect([400, 500]).toContain(res.status);
    expect(JSON.stringify(res.body)).toContain('masa depan');
  });
});
