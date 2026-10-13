import { describe, it, expect, beforeAll } from 'vitest';
import prisma from '../../src/config/prisma';
import authService from '../../src/services/authService';
import userService from '../../src/services/userService';
import { USERS, seedUser } from '../helpers';

// ============================================================
// UNIT — authService: register & login
// ============================================================
describe('authService (unit)', () => {
  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: USERS.employee.email } }).catch(() => {});
  });

  it('register menolak payload tidak lengkap', async () => {
    await expect(authService.register({ email: 'x@y.z', password: '123456' }))
      .rejects.toThrow('wajib diisi');
    await expect(authService.register({ name: 'X', email: 'x@y.z', password: '123' }))
      .rejects.toThrow('minimal 6 karakter');
  });

  it('register membuat user EMPLOYEE + token berisi role', async () => {
    const { user, token } = await authService.register(USERS.employee);
    expect(user.role).toBe('EMPLOYEE');
    expect(user.email).toBe(USERS.employee.email);
    const payload: any = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    expect(payload.role).toBe('EMPLOYEE');
    expect(payload.id).toBe(user.id);
  });

  it('register menolak email duplikat', async () => {
    await expect(authService.register(USERS.employee))
      .rejects.toThrow('email sudah terdaftar');
  });

  it('login sukses dengan kredensial benar', async () => {
    const { user, token } = await authService.login({
      email: USERS.employee.email,
      password: USERS.employee.password,
    });
    expect(user.id).toBeTruthy();
    expect(token).toBeTruthy();
  });

  it('login menolak password salah', async () => {
    await expect(authService.login({ email: USERS.employee.email, password: 'salahbanget' }))
      .rejects.toThrow('email atau password salah');
  });

  it('login menolak email tidak terdaftar', async () => {
    await expect(authService.login({ email: 'hantu@example.com', password: 'password123' }))
      .rejects.toThrow('email atau password salah');
  });

  it('email dinormalisasi lowercase', async () => {
    const { user } = await authService.login({
      email: USERS.employee.email.toUpperCase(),
      password: USERS.employee.password,
    });
    expect(user.email).toBe(USERS.employee.email);
  });
});

// ============================================================
// UNIT — userService: role validation
// ============================================================
describe('userService (unit)', () => {
  it('createUser menolak role tidak valid', async () => {
    await expect(userService.createUser({
      name: 'Rogue', email: 'rogue@example.com', password: 'password123', role: 'SUPERADMIN',
    })).rejects.toThrow('role harus EMPLOYEE, MANAGER, atau FINANCE');
  });

  it('createUser menolak data tidak lengkap', async () => {
    await expect(userService.createUser({ name: 'X' }))
      .rejects.toThrow('wajib diisi');
  });

  it('createUser + getUsers(role) berfungsi', async () => {
    const created = await seedUser(prisma, { ...USERS.manager, role: 'MANAGER' });
    expect(created.role).toBe('MANAGER');
    const managers = await userService.getUsers('MANAGER');
    expect(managers.some((u: any) => u.email === USERS.manager.email)).toBe(true);
  });

  it('updateUser menolak role tidak valid', async () => {
    const user = await seedUser(prisma, { ...USERS.admin, role: 'EMPLOYEE' });
    await expect(userService.updateUser(user.id, { role: 'GOD' }))
      .rejects.toThrow('role harus');
  });
});
