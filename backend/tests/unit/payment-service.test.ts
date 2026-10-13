import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../../src/config/prisma';
import paymentService from '../../src/services/paymentService';
import { USERS, seedUser, seedClaim, setStatus } from '../helpers';

// ============================================================
// UNIT — paymentService: validasi & guard status
// ============================================================
describe('paymentService (unit)', () => {
  let finance: any, employee: any;

  beforeAll(async () => {
    finance = await seedUser(prisma, { ...USERS.finance, role: 'FINANCE' });
    employee = await seedUser(prisma, { ...USERS.employee2, role: 'EMPLOYEE' });
  });

  it('menolak method tidak valid', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'READY_FOR_PAYMENT' });
    await expect(paymentService.completePayment(claim.id, { method: 'BITCOIN', reference: 'X' }, finance))
      .rejects.toThrow('method harus BANK_TRANSFER, CASH, atau OTHER');
  });

  it('completePayment ditolak jika status belum READY_FOR_PAYMENT', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'MANAGER_APPROVED' });
    const result = await paymentService.completePayment(claim.id, { method: 'BANK_TRANSFER', reference: 'TRX-1' }, finance);
    expect(result?.error).toContain('READY_FOR_PAYMENT');
  });

  it('completePayment sukses saat READY_FOR_PAYMENT: status -> PAID + notifikasi', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'READY_FOR_PAYMENT' });
    const result = await paymentService.completePayment(
      claim.id,
      { method: 'BANK_TRANSFER', reference: 'TRX-TEST-001', note: 'bayar test' },
      finance,
    );
    expect(result?.error).toBeUndefined();
    expect(result.status).toBe('COMPLETED');

    const after = await prisma.reimbursement.findUnique({ where: { id: claim.id } });
    expect(after.status).toBe('PAID');

    const notifs = await prisma.notification.findMany({ where: { reimbursementId: claim.id } });
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs.some((n: any) => n.userId === employee.id)).toBe(true);
  });

  it('uploadProof ditolak saat status bukan READY_FOR_PAYMENT/PAID', async () => {
    const claim = await seedClaim(prisma, employee, { status: 'FINANCE_REVIEW' });
    const result = await paymentService.uploadProof(claim.id, 'https://example.com/proof.pdf', finance);
    expect(String(result?.error)).toContain('READY_FOR_PAYMENT');
  });
});
