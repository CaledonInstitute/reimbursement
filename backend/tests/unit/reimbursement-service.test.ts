import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../../src/config/prisma';
import reimbursementService from '../../src/services/reimbursementService';
import { USERS, seedUser, seedClaim, claimPayload } from '../helpers';

// ============================================================
// UNIT — reimbursementService: validasi payload & state machine
// ============================================================
describe('reimbursementService — createReimbursement (unit)', () => {
  let employee: any;

  beforeAll(async () => {
    employee = await seedUser(prisma, { ...USERS.employee2, role: 'EMPLOYEE' });
  });

  it('menolak amount negatif', async () => {
    await expect(reimbursementService.createReimbursement({
      employeeName: 'X', employeeEmail: 'x@y.z', category: 'Transportasi',
      amount: -5, employeeId: employee.id,
    })).rejects.toThrow('amount must be a non-negative number');
  });

  it('menolak expense total != amount', async () => {
    await expect(reimbursementService.createReimbursement({
      employeeName: 'X', employeeEmail: 'x@y.z', category: 'Transportasi',
      amount: 100000, employeeId: employee.id,
      expenses: [{ category: 'Transportasi', amount: 90000, expenseDate: new Date(), description: 'x' }],
    })).rejects.toThrow('Total expense harus sama dengan total reimbursement');
  });

  it('menolak expense <= 0', async () => {
    await expect(reimbursementService.createReimbursement({
      employeeName: 'X', employeeEmail: 'x@y.z', category: 'Transportasi',
      amount: 100000, employeeId: employee.id,
      expenses: [{ category: 'Transportasi', amount: 0, expenseDate: new Date(), description: 'x' }],
    })).rejects.toThrow('lebih besar dari nol');
  });

  it('menolak expenseDate di masa depan', async () => {
    await expect(reimbursementService.createReimbursement({
      employeeName: 'X', employeeEmail: 'x@y.z', category: 'Transportasi',
      amount: 100000, employeeId: employee.id,
      expenses: [{ category: 'Transportasi', amount: 100000, expenseDate: new Date(Date.now() + 86400000), description: 'x' }],
    })).rejects.toThrow('expenseDate tidak boleh di masa depan');
  });

  it('menolak receiptUrl bukan http/https', async () => {
    await expect(reimbursementService.createReimbursement({
      employeeName: 'X', employeeEmail: 'x@y.z', category: 'Transportasi',
      amount: 100000, employeeId: employee.id,
      receiptUrl: 'ftp://files/receipt.pdf',
    })).rejects.toThrow('receiptUrl harus berupa URL http atau https');
  });

  it('membuat draft dengan status DRAFT + audit log', async () => {
    const claim = await reimbursementService.createReimbursement({
      ...claimPayload(),
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email,
    });
    expect(claim.status).toBe('DRAFT');
    const logs = await prisma.auditLog.findMany({ where: { reimbursementId: claim.id, action: 'REIMBURSEMENT_CREATED' } });
    expect(logs.length).toBe(1);
  });
});

describe('reimbursementService — state machine (unit)', () => {
  let employee: any, manager: any, finance: any;

  beforeAll(async () => {
    employee = await seedUser(prisma, { ...USERS.employee2, role: 'EMPLOYEE' });
    manager = await seedUser(prisma, { ...USERS.manager, role: 'MANAGER' });
    finance = await seedUser(prisma, { ...USERS.finance, role: 'FINANCE' });
  });

  it('submit menolak tanpa bukti (receiptUrl kosong)', async () => {
    const claim = await prisma.reimbursement.create({
      data: {
        employeeName: employee.name, employeeEmail: employee.email, employeeId: employee.id,
        amount: 100000, category: 'Transportasi', description: 'no receipt', status: 'DRAFT',
        receiptUrl: '',
        expenses: { create: { category: 'Transportasi', amount: 100000, expenseDate: new Date(), description: 'x', receiptUrl: '' } },
      },
    });
    await expect(reimbursementService.submitReimbursement(claim.id, employee.id))
      .rejects.toThrow('Minimal satu bukti');
  });

  it('transisi ilegal ditolak: DRAFT -> FINANCE_REVIEW', async () => {
    const claim = await seedClaim(prisma, employee);
    const result = await reimbursementService.updateStatus(claim.id, 'FINANCE_REVIEW', 'skip!', employee.id, undefined, 'EMPLOYEE');
    expect(String(result?.error)).toContain('tidak diizinkan');
  });

  it('transisi ilegal ditolak: PAID -> apa pun', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'PAID' });
    const result = await reimbursementService.updateStatus(claim.id, 'SUBMITTED', 'zombie', employee.id, undefined, 'EMPLOYEE');
    expect(String(result?.error)).toContain('tidak diizinkan');
  });

  it('manager approve hanya dari SUBMITTED', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'DRAFT' });
    const result = await reimbursementService.managerReview(claim.id, 'approve', undefined, manager.id);
    // Klaim DRAFT tidak terlihat oleh manager (access filter) -> null
    expect(result).toBeNull();
  });

  it('manager revise wajib ada note', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'SUBMITTED' });
    await expect(reimbursementService.managerReview(claim.id, 'revise', undefined, manager.id))
      .rejects.toThrow('Catatan wajib diisi');
  });

  it('finance aksi valid per status: verify hanya saat FINANCE_REVIEW', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'MANAGER_APPROVED' });
    const result = await reimbursementService.financeReview(claim.id, 'verify', undefined, finance.id);
    expect(String(result?.error)).toContain('Finance tidak dapat melakukan aksi');
  });

  it('finance revise wajib ada note', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'FINANCE_REVIEW' });
    await expect(reimbursementService.financeReview(claim.id, 'revise', undefined, finance.id))
      .rejects.toThrow('Catatan wajib diisi');
  });

  it('update hapus edit ditolak setelah approval', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'MANAGER_APPROVED' });
    await expect(reimbursementService.updateReimbursement(claim.id, { description: 'hack' }, employee))
      .rejects.toThrow('hanya bisa diubah saat DRAFT');
    await expect(reimbursementService.deleteReimbursement(claim.id, employee))
      .rejects.toThrow('hanya bisa dihapus saat DRAFT');
  });

  it('employee tidak melihat klaim employee lain (scoping findById)', async () => {
    const other = await seedUser(prisma, {
      name: 'Other Emp', email: 'other.emp@example.com', password: 'password123', role: 'EMPLOYEE',
    });
    const claim = await seedClaim(prisma, other);
    const visible = await reimbursementService.getReimbursementById(claim.id, employee);
    expect(visible).toBeNull();
  });
});
