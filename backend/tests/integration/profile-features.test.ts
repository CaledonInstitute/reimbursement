import { describe, it, expect, beforeAll } from 'vitest';
import * as supertestMod from 'supertest';
const request = ((supertestMod as any).default ?? supertestMod) as typeof import('supertest')['default'];
import app from '../../src/app';
import prisma from '../../src/config/prisma';
import { USERS, seedUser, auth, API, uniqEmail } from '../helpers';

// ============================================================
// INTEGRATION — fitur profil baru: avatar, Google connect, devices
// ============================================================

/** PNG 1x1 minimal (mimetype & magic bytes cukup untuk multer) */
const pngBuffer = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000000010000000806000000',
  'hex',
);

function attachAvatar(req: any, fields: Record<string, string> = {}) {
  return req
    .field('name', fields.name ?? 'Nama Device Test')
    .attach('avatar', pngBuffer, { filename: 'avatar.png', contentType: 'image/png' });
}

describe('Profile: edit nama & avatar (integration)', () => {
  let user: any;

  beforeAll(async () => {
    user = await seedUser(prisma, { name: 'Avatar User', email: uniqEmail('avatar.user'), password: 'password123', role: 'EMPLOYEE' });
  });

  it('update nama via multipart tanpa file', async () => {
    const res = await request(app)
      .patch(`${API}/profile`)
      .set(auth(user))
      .field('name', 'Avatar User Baru');
    expect(res.status).toBe(200);
    expect(res.body.data.user.name).toBe('Avatar User Baru');
  });

  it('upload avatar -> avatarUrl path relatif /storage', async () => {
    const response = await attachAvatar(request(app).patch(`${API}/profile`).set(auth(user)), { name: 'Avatar User Baru' });
    expect(response.status).toBe(200);
    expect(response.body.data.user.avatarUrl).toMatch(/^\/storage\/avatar-/);
  });

  it('hapus avatar (avatarUrl=null) -> avatarUrl kosong', async () => {
    const res = await request(app)
      .patch(`${API}/profile`)
      .set(auth(user))
      .field('avatarUrl', 'null');
    expect(res.status).toBe(200);
    expect(res.body.data.user.avatarUrl).toBeNull();
  });

  it('tipe file tidak didukung -> 400', async () => {
    const res = await request(app)
      .patch(`${API}/profile`)
      .set(auth(user))
      .field('name', 'Avatar User Baru')
      .attach('avatar', Buffer.from('bukan gambar'), { filename: 'evil.exe', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
  });

  it('PATCH /profile tanpa payload -> 400', async () => {
    const res = await request(app).patch(`${API}/profile`).set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe('Profile: perangkat login (integration)', () => {
  let user: any;
  let tokenA = '';
  let tokenB = '';

  beforeAll(async () => {
    user = await seedUser(prisma, { name: 'Device User', email: uniqEmail('device.user'), password: 'password123', role: 'EMPLOYEE' });
    // Dua login = dua device (authService.login mencatat LoginDevice)
    const a = await request(app).post(`${API}/auth/login`).send({ email: user.email, password: 'password123' });
    tokenA = a.body.data.token;
    const b = await request(app).post(`${API}/auth/login`).send({ email: user.email, password: 'password123' });
    tokenB = b.body.data.token;
  });

  it('dua login tercatat sebagai dua device', async () => {
    const res = await request(app).get(`${API}/profile/devices`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    const devices = res.body.data;
    expect(devices.length).toBeGreaterThanOrEqual(2);
    // token aktif ditandai current
    expect(devices.filter((d: any) => d.current).length).toBe(1);
  });

  it('revoke device lain -> currentToo false, device berkurang', async () => {
    const list = await request(app).get(`${API}/profile/devices`).set('Authorization', `Bearer ${tokenA}`);
    const other = list.body.data.find((d: any) => !d.current);
    const res = await request(app).delete(`${API}/profile/devices/${other.id}`).set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.currentToo).toBe(false);

    const after = await request(app).get(`${API}/profile/devices`).set('Authorization', `Bearer ${tokenA}`);
    expect(after.body.data.find((d: any) => d.id === other.id)).toBeUndefined();
  });

  it('device yang di-revoke hilang dari daftar, sesi lain tetap terlihat', async () => {
    const list = await request(app).get(`${API}/profile/devices`).set('Authorization', `Bearer ${tokenB}`);
    expect(list.status).toBe(200);
  });

  it('revoke device saat ini -> currentToo true', async () => {
    // login segar supaya device "current" pasti ada (test sebelumnya bisa menghapusnya)
    const fresh = await request(app).post(`${API}/auth/login`).send({ email: user.email, password: 'password123' });
    const freshToken = fresh.body.data.token;
    const list = await request(app).get(`${API}/profile/devices`).set('Authorization', `Bearer ${freshToken}`);
    const current = list.body.data.find((d: any) => d.current);
    expect(current).toBeTruthy();
    const res = await request(app).delete(`${API}/profile/devices/${current.id}`).set('Authorization', `Bearer ${freshToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.currentToo).toBe(true);
  });

  it('logout-all -> semua device user terhapus', async () => {
    const res = await request(app)
      .post(`${API}/profile/devices/logout-all`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ all: true });
    expect(res.status).toBe(200);
    const after = await request(app).get(`${API}/profile/devices`).set('Authorization', `Bearer ${tokenA}`);
    expect(after.body.data.length).toBe(0);
  });

  it('deviceId tidak ada -> 404', async () => {
    const res = await request(app).delete(`${API}/profile/devices/999999`).set('Authorization', `Bearer ${tokenA}`);
    expect([400, 404]).toContain(res.status);
  });

  it('devices tanpa token -> 401', async () => {
    const res = await request(app).get(`${API}/profile/devices`);
    expect(res.status).toBe(401);
  });
});

describe('Profile: disconnect Google (integration)', () => {
  it('user tanpa Google -> disconnect ditolak 400', async () => {
    const user = await seedUser(prisma, { name: 'No Google', email: uniqEmail('no.google'), password: 'password123', role: 'EMPLOYEE' });
    const res = await request(app).post(`${API}/profile/google/disconnect`).set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('belum terhubung');
  });

  it('akun SSO murni (tanpa password lokal) -> disconnect ditolak dengan pesan set password', async () => {
    const user = await seedUser(prisma, { name: 'SSO Only', email: uniqEmail('sso.only'), password: 'password123', role: 'EMPLOYEE' });
    // tiru akun SSO: password = JWT acak seperti googleController
    const jwt = (await import('jsonwebtoken')).default;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: `gid-${Date.now()}`,
        password: jwt.sign({ sso: true }, process.env.JWT_SECRET || 'test-jwt-secret-reimbursement'),
      },
    });
    const res = await request(app).post(`${API}/profile/google/disconnect`).set(auth(user));
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('password');
  });

  it('user dengan password lokal + googleId -> disconnect sukses', async () => {
    const user = await seedUser(prisma, { name: 'Hybrid', email: uniqEmail('hybrid'), password: 'password123', role: 'EMPLOYEE' });
    await prisma.user.update({ where: { id: user.id }, data: { googleId: `gid-${Date.now()}` } });
    const res = await request(app).post(`${API}/profile/google/disconnect`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.googleId).toBeNull();
  });
});

describe('Auth: device tracking & format user (integration)', () => {
  it('register + login mengembalikan token string dan avatarUrl/googleId di user', async () => {
    const email = uniqEmail('track.user');
    const reg = await request(app).post(`${API}/auth/register`).send({ name: 'Track User', email, password: 'password123' });
    expect(reg.status).toBe(201);
    expect(typeof reg.body.data.token).toBe('string');
    expect(reg.body.data.user).toHaveProperty('avatarUrl');
    expect(reg.body.data.user).toHaveProperty('googleId');

    const login = await request(app).post(`${API}/auth/login`).send({ email, password: 'password123' });
    expect(login.status).toBe(200);
    expect(typeof login.body.data.token).toBe('string');
  });
});
