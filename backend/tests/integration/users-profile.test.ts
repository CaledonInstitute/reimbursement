import { describe, it, expect, beforeAll } from 'vitest';
import * as supertestMod from 'supertest';
const request = ((supertestMod as any).default ?? supertestMod) as typeof import('supertest')['default'];
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { USERS, seedUser, auth, API, uniqEmail } from '../helpers';

// ============================================================
// INTEGRATION — CRUD user (admin API) + profile
// ============================================================
describe('User management API (integration)', () => {
  let finance: any;
  beforeAll(async () => {
    finance = await seedUser(prisma, { ...USERS.finance, role: 'FINANCE' });
  });

  it('create user dengan role FINANCE', async () => {
    const res = await request(app)
      .post(`${API}/users`)
      .set(auth(finance))
      .send({ name: 'Finance Baru', email: uniqEmail('finance.baru'), password: 'password123', role: 'FINANCE' });
    expect(res.status).toBe(201);
    expect(res.body.data.role).toBe('FINANCE');
    // password tidak boleh bocor di response
    expect(JSON.stringify(res.body.data).toLowerCase()).not.toContain('password');
  });

  it('list users + filter role', async () => {
    const res = await request(app).get(`${API}/users?role=FINANCE`).set(auth(finance));
    expect(res.status).toBe(200);
    expect(res.body.data.every((u: any) => u.role === 'FINANCE')).toBe(true);
  });

  it('update user: promote ke MANAGER', async () => {
    const created = await request(app)
      .post(`${API}/users`)
      .set(auth(finance))
      .send({ name: 'Promote Me', email: uniqEmail('promote.me'), password: 'password123', role: 'EMPLOYEE' });
    const id = created.body.data.id;
    const res = await request(app)
      .patch(`${API}/users/${id}`)
      .set(auth(finance))
      .send({ role: 'MANAGER' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('MANAGER');
  });

  it('delete user', async () => {
    const created = await request(app)
      .post(`${API}/users`)
      .set(auth(finance))
      .send({ name: 'Delete Me', email: uniqEmail('delete.me'), password: 'password123', role: 'EMPLOYEE' });
    const id = created.body.data.id;
    const res = await request(app).delete(`${API}/users/${id}`).set(auth(finance));
    expect(res.status).toBe(204);
    const check = await prisma.user.findUnique({ where: { id } });
    expect(check).toBeNull();
  });

  it('role tidak valid -> 400/500 error terkontrol', async () => {
    const res = await request(app)
      .post(`${API}/users`)
      .set(auth(finance))
      .send({ name: 'X', email: uniqEmail('x.role'), password: 'password123', role: 'WIZARD' });
    expect([400, 500]).toContain(res.status);
    expect(res.body.success).toBe(false);
  });
});

describe('Profile & change password (integration)', () => {
  let user: any;

  beforeAll(async () => {
    user = await seedUser(prisma, { name: 'Profile User', email: uniqEmail('profile.user'), password: 'password123', role: 'EMPLOYEE' });
  });

  it('get profile', async () => {
    const res = await request(app).get(`${API}/profile`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(user.email);
  });

  it('update nama', async () => {
    const res = await request(app)
      .patch(`${API}/profile`)
      .set(auth(user))
      .send({ name: 'Profile User Baru' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Profile User Baru');
  });

  it('ganti password tanpa password lama -> ditolak', async () => {
    const res = await request(app)
      .patch(`${API}/profile`)
      .set(auth(user))
      .send({ password: 'newpassword1' });
    expect([400, 500]).toContain(res.status);
  });

  it('ganti password dengan password lama salah -> ditolak', async () => {
    const res = await request(app)
      .patch(`${API}/profile`)
      .set(auth(user))
      .send({ currentPassword: 'bukan-password', password: 'newpassword1' });
    expect([400, 500]).toContain(res.status);
  });

  it('ganti password sukses -> login dengan password baru OK', async () => {
    const res = await request(app)
      .patch(`${API}/profile`)
      .set(auth(user))
      .send({ currentPassword: 'password123', password: 'newpassword1' });
    expect(res.status).toBe(200);

    const login = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: 'newpassword1' });
    expect(login.status).toBe(200);
  });
});

describe('Health & docs (integration)', () => {
  it('GET / -> API running', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
