# Test Suite Backend (Vitest + Supertest)

## Menjalankan
```bash
sudo -iu andika
export NVM_DIR=/home/andika/.nvm; . /home/andika/.nvm/nvm.sh
cd /home/andika/projects/reimbursement/backend
npm test          # sekali jalan
npm run test:watch
```

## Struktur
- `tests/setup.ts` — globalSetup: set `DATABASE_URL` ke DB `reimbursement_test`, push schema prisma
- `tests/helpers.ts` — seedUser/seedClaim/setStatus/auth/claimPayload/uniqEmail
- `tests/unit/` — authService, userService, reimbursementService (validasi + state machine), paymentService
- `tests/integration/` — supertest terhadap app: RBAC 401/403, lifecycle EMPLOYEE, review MANAGER, pembayaran FINANCE, users/profile, reports

DB test terpisah (`reimbursement_test`) — data development tidak terganggu. Test berjalan berurutan (singleFork) karena berbagi satu DB test. Email test unik per run (`uniqEmail`) agar aman dijalankan berulang.
