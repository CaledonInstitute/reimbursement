import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import config from '../config';
import authModel from '../models/authModel';

const validateCredentials = ({ name, email, password }: { name?: unknown; email?: unknown; password?: unknown }) => {
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    throw new Error('name, email, dan password wajib diisi.');
  }

  if (password.length < 6) {
    throw new Error('password minimal 6 karakter.');
  }

  return {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password,
    role: 'EMPLOYEE',
  };
};

const publicUser = (user: any) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl,
  googleId: user.googleId,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// Token punya jti unik supaya bisa dicocokkan dengan LoginDevice
const createToken = (user: any) => {
  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    config.jwtSecret,
    { expiresIn: '1d', jwtid: jti },
  );
  return { token, jti };
};

// Catat perangkat tempat token diterbitkan
const trackDevice = (user: any, tokenId: string, req?: any) => prisma.loginDevice.upsert({
  where: { tokenId },
  update: { lastActiveAt: new Date() },
  create: {
    userId: user.id,
    tokenId,
    userAgent: (req?.headers?.['user-agent'] as string) || null,
    ip: (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req?.ip || null,
  },
});

const register = async (payload: any, req?: any) => {
  const data = validateCredentials(payload);
  const existingUser = await authModel.findUserByEmail(data.email);

  if (existingUser) {
    throw new Error('email sudah terdaftar.');
  }

  const password = await bcrypt.hash(data.password, 12);
  const user = await authModel.createUser({ ...data, password });
  const { token, jti } = createToken(user);
  await trackDevice(user, jti, req);

  return { user: publicUser(user), token };
};

const login = async ({ email, password }: { email?: unknown; password?: unknown }, req?: any) => {
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new Error('email dan password wajib diisi.');
  }

  const user = await authModel.findUserByEmail(email.trim().toLowerCase());
  const passwordMatches = user && await bcrypt.compare(password, user.password);

  if (!passwordMatches) {
    throw new Error('email atau password salah.');
  }

  const { token, jti } = createToken(user);
  await trackDevice(user, jti, req);

  return { user: publicUser(user), token };
};

export default {
  register,
  login,
  createToken,
  trackDevice,
  publicUser,
};
