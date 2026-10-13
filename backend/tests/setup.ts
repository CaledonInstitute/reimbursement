import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// DB test terpisah supaya data development tidak terganggu.
let dbPass = 'postgres';
try {
  dbPass = readFileSync('/tmp/md/dbpass.txt', 'utf8').trim();
} catch {}

process.env.DATABASE_URL = `postgresql://postgres:${dbPass}@localhost:5432/reimbursement_test?schema=public`;
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-reimbursement';
process.env.NODE_ENV = 'test';

export default async function setup() {
  // Terapkan skema Prisma ke DB test (idempotent)
  execSync('npx prisma migrate deploy', {
    cwd: '/home/andika/projects/reimbursement/backend',
    env: { ...process.env },
    stdio: 'pipe',
  });
}
