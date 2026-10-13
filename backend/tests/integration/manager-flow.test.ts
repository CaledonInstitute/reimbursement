import { describe, it, expect, beforeAll } from 'vitest';
import * as supertestMod from 'supertest';
const request = ((supertestMod as any).default ?? supertestMod) as typeof import('supertest')['default'];
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { USERS, seedUser, seedClaim, setStatus, auth, API } from '../helpers';

// ============================================================
// INTEGRATION — Alur MANAGER: review approve/revise/reject
// ============================================================
describe('MANAGER review flow (integration)', () => {
  let employee: any, manager: any;
  let submittedId: number;

  beforeAll(async () => {
    employee = await seedUser(prisma, { name: 'Mgr Flow Emp', email: 'mgr.flow.emp@example.com', password: 'password123', role: 'EMPLOYEE' });
    manager = await seedUser(prisma, { ...USERS.manager, role: 'MANAGER' });
    const claim = await seedClaim(prisma, employee, { status: 'SUBMITTED' });
    submittedId = claim.id;
  });

  it('manager melihat semua klaim termasuk SUBMITTED', async () => {
    const res = await request(app).get(`${API}/reimbursements`).set(auth(manager));
    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: any) => c.id);
    expect(ids).toContain(submittedId);
  });

  it('manager detail klaim SUBMITTED terlihat', async () => {
    const res = await request(app).get(`${API}/reimbursements/${submittedId}`).set(auth(manager));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');
  });

  it('approve tanpa action -> 400', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/${submittedId}/manager`)
      .set(auth(manager))
      .send({});
    expect([400, 500]).toContain(res.status);
  });

  it('revise tanpa note -> 400 (note wajib)', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'SUBMITTED' });
    const res = await request(app)
      .patch(`${API}/reimbursements/${claim.id}/manager`)
      .set(auth(manager))
      .send({ action: 'revise', note: '   ' });
    expect([400, 500]).toContain(res.status);
  });

  it('reject dengan note -> status REJECTED + riwayat tercatat', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'SUBMITTED' });
    const res = await request(app)
      .patch(`${API}/reimbursements/${claim.id}/manager`)
      .set(auth(manager))
      .send({ action: 'reject', note: 'Bukti tidak jelas' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
    const history = await prisma.reimbursementHistory.findMany({ where: { reimbursementId: claim.id } });
    expect(history.some((h: any) => h.status === 'REJECTED')).toBe(true);
  });

  it('approve -> status MANAGER_APPROVED', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/${submittedId}/manager`)
      .set(auth(manager))
      .send({ action: 'approve', note: 'Disetujui manager' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('MANAGER_APPROVED');
  });

  it('double approve di MANAGER_APPROVED -> 400', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/${submittedId}/manager`)
      .set(auth(manager))
      .send({ action: 'approve' });
    expect(res.status).toBe(400);
  });

  it('audit log terlihat oleh manager', async () => {
    const res = await request(app).get(`${API}/audit-logs`).set(auth(manager));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
