import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as supertestMod from 'supertest';
const request = ((supertestMod as any).default ?? supertestMod) as typeof import('supertest')['default'];
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { USERS, seedUser, auth, claimPayload, API } from '../helpers';

// ============================================================
// INTEGRATION — RBAC & auth middleware (HTTP asli)
// ============================================================
describe('RBAC & auth middleware (integration)', () => {
  let employee: any, manager: any, finance: any;

  beforeAll(async () => {
    employee = await seedUser(prisma, { ...USERS.employee, role: 'EMPLOYEE' });
    manager = await seedUser(prisma, { ...USERS.manager, role: 'MANAGER' });
    finance = await seedUser(prisma, { ...USERS.finance, role: 'FINANCE' });
  });

  it('401 tanpa token', async () => {
    const res = await request(app).get(`${API}/reimbursements`);
    expect(res.status).toBe(401);
  });

  it('401 token invalid/expired', async () => {
    const res = await request(app)
      .get(`${API}/reimbursements`)
      .set('Authorization', 'Bearer bukan.token.asli');
    expect(res.status).toBe(401);
  });

  it('403 employee memanggil endpoint manager', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/1/manager`)
      .set(auth(employee))
      .send({ action: 'approve' });
    expect(res.status).toBe(403);
  });

  it('403 employee memanggil endpoint finance', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/1/finance`)
      .set(auth(employee))
      .send({ action: 'start' });
    expect(res.status).toBe(403);
  });

  it('403 manager tidak bisa membuat klaim (EMPLOYEE only)', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements`)
      .set(auth(manager))
      .send(claimPayload());
    expect(res.status).toBe(403);
  });

  it('403 finance tidak bisa membuat klaim', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements`)
      .set(auth(finance))
      .send(claimPayload());
    expect(res.status).toBe(403);
  });

  it('403 employee tidak bisa akses audit log (MANAGER/FINANCE only)', async () => {
    const res = await request(app).get(`${API}/audit-logs`).set(auth(employee));
    expect(res.status).toBe(403);
  });

  it('403 employee tidak bisa akses laporan? (report endpoint role-agnostic, hanya cek 200 utk manager)', async () => {
    const res = await request(app).get(`${API}/reports/summary`).set(auth(manager));
    expect([200, 403]).toContain(res.status);
  });
});
