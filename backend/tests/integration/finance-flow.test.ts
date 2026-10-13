import { describe, it, expect, beforeAll } from 'vitest';
import * as supertestMod from 'supertest';
const request = ((supertestMod as any).default ?? supertestMod) as typeof import('supertest')['default'];
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { USERS, seedUser, seedClaim, setStatus, auth, claimPayload, API } from '../helpers';

// ============================================================
// INTEGRATION — Alur FINANCE: verify -> bayar -> bukti
// ============================================================
describe('FINANCE payment flow (integration)', () => {
  let employee: any, finance: any;
  let claimId: number;

  beforeAll(async () => {
    employee = await seedUser(prisma, { name: 'Fin Flow Emp', email: 'fin.flow.emp@example.com', password: 'password123', role: 'EMPLOYEE' });
    finance = await seedUser(prisma, { ...USERS.finance, role: 'FINANCE' });
    const claim = await seedClaim(prisma, employee, { status: 'MANAGER_APPROVED' });
    claimId = claim.id;
  });

  it('finance melihat klaim MANAGER_APPROVED dalam scope-nya', async () => {
    const res = await request(app).get(`${API}/reimbursements`).set(auth(finance));
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: any) => c.id)).toContain(claimId);
  });

  it('bayar sebelum verify -> ditolak (harus READY_FOR_PAYMENT)', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements/${claimId}/payment`)
      .set(auth(finance))
      .send({ method: 'BANK_TRANSFER', reference: 'EARLY-1' });
    expect([400, 404, 500]).toContain(res.status);
  });

  it('start verify -> FINANCE_REVIEW', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/${claimId}/finance`)
      .set(auth(finance))
      .send({ action: 'start' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('FINANCE_REVIEW');
  });

  it('verify dengan note -> READY_FOR_PAYMENT', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/${claimId}/finance`)
      .set(auth(finance))
      .send({ action: 'verify', note: 'Terverifikasi finance' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('READY_FOR_PAYMENT');
  });

  it('employee tidak bisa memproses pembayaran (403)', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements/${claimId}/payment`)
      .set(auth(employee))
      .send({ method: 'BANK_TRANSFER', reference: 'HACK-1' });
    expect(res.status).toBe(403);
  });

  it('completePayment -> PAID + history + notifikasi utk employee', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements/${claimId}/payment`)
      .set(auth(finance))
      .send({ method: 'BANK_TRANSFER', reference: 'TRX-FLOW-001', note: 'Pembayaran diproses' });
    expect([200, 201]).toContain(res.status);
    expect(res.body.data.status).toBe('COMPLETED');

    const claim = await prisma.reimbursement.findUnique({ where: { id: claimId } });
    expect(claim.status).toBe('PAID');

    const notifs = await prisma.notification.findMany({ where: { reimbursementId: claimId } });
    expect(notifs.some((n: any) => n.userId === employee.id)).toBe(true);
  });

  it('bayar ulang klaim PAID -> ditolak', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements/${claimId}/payment`)
      .set(auth(finance))
      .send({ method: 'BANK_TRANSFER', reference: 'DOUBLE-1' });
    expect([400, 404, 500]).toContain(res.status);
  });

  it('upload bukti transfer setelah PAID -> sukses', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements/${claimId}/payment/proof`)
      .set(auth(finance))
      .attach('proof', Buffer.from('%PDF-1.4 test'), 'bukti.pdf');
    expect([200, 201]).toContain(res.status);
  });

  it('detail pembayaran bisa dibaca finance', async () => {
    const res = await request(app)
      .get(`${API}/reimbursements/${claimId}/payment`)
      .set(auth(finance));
    expect([200, 201]).toContain(res.status);
    expect(res.body.data.status).toBe('COMPLETED');
  });
});

// ============================================================
// INTEGRATION — FINANCE revise/reject dari FINANCE_REVIEW
// ============================================================
describe('FINANCE revise/reject (integration)', () => {
  let employee: any, finance: any;
  let reviseId: number, rejectId: number;

  beforeAll(async () => {
    employee = await seedUser(prisma, { name: 'Fin Rev Emp', email: 'fin.rev.emp@example.com', password: 'password123', role: 'EMPLOYEE' });
    finance = await seedUser(prisma, { ...USERS.finance, role: 'FINANCE' });
    reviseId = (await seedClaim(prisma, employee, { status: 'FINANCE_REVIEW' })).id;
    rejectId = (await seedClaim(prisma, employee, { status: 'FINANCE_REVIEW' })).id;
  });

  it('revise dengan note -> REVISION_REQUIRED', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/${reviseId}/finance`)
      .set(auth(finance))
      .send({ action: 'revise', note: 'Nominal tidak match struk' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REVISION_REQUIRED');
  });

  it('reject dengan note -> REJECTED', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/${rejectId}/finance`)
      .set(auth(finance))
      .send({ action: 'reject', note: 'Tidak memenuhi kebijakan' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('REJECTED');
  });

  it('klaim REVISION_REQUIRED bisa di-submit ulang oleh employee', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/${reviseId}/submit`)
      .set(auth(employee));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');
  });
});

// ============================================================
// INTEGRATION — Laporan summary (FINANCE)
// ============================================================
describe('Report summary (integration)', () => {
  it('finance mendapat summary dengan total & byStatus', async () => {
    const finance = await seedUser(prisma, { ...USERS.finance, role: 'FINANCE' });
    const res = await request(app).get(`${API}/reports/summary`).set(auth(finance));
    expect(res.status).toBe(200);
    expect(typeof res.body.data.total).toBe('number');
    expect(typeof res.body.data.totalAmount).toBe('number');
    expect(res.body.data.byStatus).toBeTypeOf('object');
  });

  it('status filter tidak valid -> 400', async () => {
    const finance = await seedUser(prisma, { ...USERS.finance, role: 'FINANCE' });
    const res = await request(app)
      .get(`${API}/reports/summary?status=BUKAN_STATUS`)
      .set(auth(finance));
    expect([400, 500]).toContain(res.status);
  });
});
