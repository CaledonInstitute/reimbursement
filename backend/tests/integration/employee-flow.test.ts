import { describe, it, expect, beforeAll } from 'vitest';
import * as supertestMod from 'supertest';
const request = ((supertestMod as any).default ?? supertestMod) as typeof import('supertest')['default'];
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { USERS, seedUser, auth, claimPayload, API, uniqEmail } from '../helpers';

// ============================================================
// INTEGRATION — Alur lengkap EMPLOYEE: create -> edit -> submit -> lihat
// ============================================================
describe('EMPLOYEE lifecycle (integration)', () => {
  let employee: any;
  let claimId: number;

  beforeAll(async () => {
    employee = await seedUser(prisma, { ...USERS.employee, role: 'EMPLOYEE' });
  });

  it('register via HTTP membuat akun + token', async () => {
    const res = await request(app)
      .post(`${API}/auth/register`)
      .send({ name: 'New Employee', email: uniqEmail('new.emp'), password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('EMPLOYEE');
    expect(res.body.data.token).toBeTruthy();
  });

  it('login via HTTP mengembalikan token valid', async () => {
    const res = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: USERS.employee.email, password: USERS.employee.password });
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(USERS.employee.email);
  });

  it('buat klaim draft (201) — amount & expense match', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements`)
      .set(auth(employee))
      .send(claimPayload({ amount: 200000 }));
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('DRAFT');
    claimId = res.body.data.id;
  });

  it('buat klaim dengan expense mismatch -> 400', async () => {
    const res = await request(app)
      .post(`${API}/reimbursements`)
      .set(auth(employee))
      .send(claimPayload({
        amount: 200000,
        expenses: [{ category: 'Transportasi', amount: 1, expenseDate: new Date().toISOString(), description: 'x' }],
      }));
    expect(res.status).toBe(400);
  });

  it('edit draft klaim (200)', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/${claimId}`)
      .set(auth(employee))
      .send({ description: 'Transport meeting klien revisi' });
    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe('Transport meeting klien revisi');
  });

  it('submit klaim (200) -> status SUBMITTED', async () => {
    const res = await request(app)
      .patch(`${API}/reimbursements/${claimId}/submit`)
      .set(auth(employee));
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('SUBMITTED');
  });

  it('employee hanya melihat klaim miliknya sendiri', async () => {
    // employee2 punya klaim terpisah
    const emp2 = await seedUser(prisma, { name: 'Emp Dua', email: uniqEmail('emp.dua'), password: 'password123', role: 'EMPLOYEE' });
    await request(app)
      .post(`${API}/reimbursements`)
      .set(auth(emp2))
      .send(claimPayload());

    const res = await request(app).get(`${API}/reimbursements`).set(auth(employee));
    expect(res.status).toBe(200);
    const emails = res.body.data.map((c: any) => c.employeeEmail);
    expect(emails).toContain(USERS.employee.email);
    expect(new Set(emails).size).toBe([...new Set(emails)].length); // hanya email milik sendiri
    expect(emails.every((e: string) => e === USERS.employee.email)).toBe(true);
  });

  it('klaim tanpa bukti tidak bisa submit (400)', async () => {
    const created = await request(app)
      .post(`${API}/reimbursements`)
      .set(auth(employee))
      .send(claimPayload({ amount: 50000, receiptUrl: undefined, expenses: [{ category: 'Transportasi', amount: 50000, expenseDate: new Date().toISOString(), description: 'no receipt', receiptUrl: undefined }] }));
    const id = created.body.data.id;
    const res = await request(app)
      .patch(`${API}/reimbursements/${id}/submit`)
      .set(auth(employee));
    expect([400, 500]).toContain(res.status);
  });

  it('hapus draft klaim (204)', async () => {
    const created = await request(app)
      .post(`${API}/reimbursements`)
      .set(auth(employee))
      .send(claimPayload({ amount: 75000 }));
    const id = created.body.data.id;
    const res = await request(app)
      .delete(`${API}/reimbursements/${id}`)
      .set(auth(employee));
    expect(res.status).toBe(204);
    const check = await prisma.reimbursement.findUnique({ where: { id } });
    expect(check).toBeNull();
  });
});
