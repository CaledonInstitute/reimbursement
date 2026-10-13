import jwt from 'jsonwebtoken';

export const API = '/api';

const SECRET = process.env.JWT_SECRET || 'test-jwt-secret-reimbursement';

export const USERS = {
  employee: { name: 'Employee Test', email: 'employee.test@example.com', password: 'password123' },
  employee2: { name: 'Employee Dua', email: 'employee2.test@example.com', password: 'password123' },
  manager: { name: 'Manager Test', email: 'manager.test@example.com', password: 'password123' },
  finance: { name: 'Finance Test', email: 'finance.test@example.com', password: 'password123' },
  admin: { name: 'Admin Test', email: 'admin.test@example.com', password: 'password123' },
};

/** Buat user langsung via prisma (cepat, tanpa HTTP), password di-hash bcrypt */
export async function seedUser(prisma: any, { name, email, password, role }: any) {
  const bcrypt = (await import('bcrypt')).default;
  const hash = await bcrypt.hash(password, 4);
  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: { name, email, password: hash, role },
  });
  return user;
}

/** Token JWT ala authService.createToken */
export function tokenFor(user: any) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '1d' },
  );
}

export function auth(user: any) {
  return { Authorization: `Bearer ${tokenFor(user)}` };
}

/** Payload claim standar: 1 expense = amount */
export function claimPayload(overrides: any = {}) {
  const amount = overrides.amount ?? 150000;
  return {
    description: overrides.description ?? 'Transport meeting klien',
    category: overrides.category ?? 'Transportasi',
    amount,
    expenses: overrides.expenses ?? [{
      category: overrides.category ?? 'Transportasi',
      amount,
      expenseDate: new Date().toISOString(),
      description: overrides.description ?? 'Transport meeting klien',
      receiptUrl: overrides.receiptUrl ?? 'https://example.com/receipt.pdf',
    }],
  };
}

/** Buat klaim langsung via model (draft) */
export async function seedClaim(prisma: any, employee: any, overrides: any = {}) {
  const created = await prisma.reimbursement.create({
    data: {
      employeeName: employee.name,
      employeeEmail: employee.email,
      employeeId: employee.id,
      amount: overrides.amount ?? 150000,
      category: overrides.category ?? 'Transportasi',
      description: overrides.description ?? 'Transport meeting klien',
      receiptUrl: overrides.receiptUrl ?? 'https://example.com/receipt.pdf',
      status: overrides.status ?? 'DRAFT',
      history: { create: { status: overrides.status ?? 'DRAFT', note: 'Test seed.' } },
      expenses: {
        create: {
          category: 'Transportasi',
          amount: overrides.amount ?? 150000,
          expenseDate: new Date(),
          description: 'Transport meeting klien',
          receiptUrl: 'https://example.com/receipt.pdf',
        },
      },
    },
  });
  return created;
}

/** Ubah status klaim + catat history (ala service.updateStatus) */
export async function setStatus(prisma: any, claimId: number, status: string, note = 'test') {
  const claim = await prisma.reimbursement.update({
    where: { id: claimId },
    data: { status },
  });
  await prisma.reimbursementHistory.create({
    data: { reimbursementId: claimId, status, note },
  });
  return claim;
}

/** Email unik per run test (DB test dipertahankan antar-run) */
export const uniqEmail = (prefix: string) => `${prefix}.${Date.now()}.${Math.floor(Math.random()*1e6)}@test.local`;
