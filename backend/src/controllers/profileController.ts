import { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import config from '../config';
import userService from '../services/userService';
import authService from '../services/authService';
import { uploadAvatarToMinio } from '../middleware/uploadReceipt';
import apiView from '../views/apiView';

const createToken = (user: any) => authService.createToken(user).token;

const authorizeConnectUrl = (clientId: string, redirectUri: string, state: string) => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);
  return url.toString();
};

const getProfile: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as typeof req & { user?: any };
    const user = await userService.getUserById(authReq.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }
    return res.json({ success: true, data: apiView.formatUser(user) });
  } catch (error) {
    return next(error);
  }
};

const updateProfile: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as typeof req & { user?: any; body: Record<string, any>; file?: Express.Multer.File };
    authReq.body = authReq.body ?? {};
    const updatePayload: Record<string, any> = {};

    if (authReq.body.name !== undefined) {
      if (typeof authReq.body.name !== 'string' || !authReq.body.name.trim()) {
        return res.status(400).json({ success: false, message: 'Nama tidak boleh kosong.' });
      }
      updatePayload.name = authReq.body.name.trim();
    }

    if (authReq.body.email !== undefined) {
      updatePayload.email = authReq.body.email;
    }

    // Upload foto profil (multipart field "avatar")
    if (authReq.file) {
      updatePayload.avatarUrl = await uploadAvatarToMinio(authReq.file);
    } else if (authReq.body.avatarUrl === 'null') {
      updatePayload.avatarUrl = null;
    }

    if (authReq.body.password !== undefined) {
      const currentPassword = authReq.body.currentPassword;
      if (typeof currentPassword !== 'string' || !currentPassword.trim()) {
        return res.status(400).json({ success: false, message: 'password lama wajib diisi.' });
      }

      if (typeof authReq.body.password !== 'string' || authReq.body.password.length < 6) {
        return res.status(400).json({ success: false, message: 'password minimal 6 karakter.' });
      }

      const currentUser = await userService.getUserById(authReq.user.id);
      const passwordMatches = currentUser && await bcrypt.compare(currentPassword, currentUser.password);

      if (!passwordMatches) {
        return res.status(400).json({ success: false, message: 'password lama salah.' });
      }

      updatePayload.password = authReq.body.password;
    }

    if (!Object.keys(updatePayload).length) {
      return res.status(400).json({ success: false, message: 'Tidak ada perubahan yang dikirim.' });
    }

    const user = await userService.updateUser(authReq.user.id, updatePayload);
    return res.json({
      success: true,
      data: {
        user: apiView.formatUser(user),
        token: createToken(user),
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Mulai alur OAuth untuk CONNECT akun Google ke akun yang sudah login.
// Dipanggil via POST form (tanpa header Bearer), jadi token diverifikasi manual.
const startGoogleConnect: RequestHandler = (req, res) => {
  const token = String((req.body as any)?.token || (req.query?.token as string) || '');
  let userId: number;
  try {
    const decoded: any = jwt.verify(token, config.jwtSecret);
    userId = Number(decoded.id);
  } catch {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid, login ulang.' });
  }
  const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
  const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
    || 'https://feels-significant-replaced-forecast.trycloudflare.com/auth/google/callback';
  const state = jwt.sign({ connectUserId: userId, ts: Date.now() }, config.jwtSecret, { expiresIn: '10m' });
  return res.redirect(authorizeConnectUrl(CLIENT_ID, REDIRECT_URI, state));
};

// Disconnect Google: hapus googleId
const disconnectGoogle: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as typeof req & { user?: any };
    const user = await userService.getUserById(authReq.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
    }
    if (!user.googleId) {
      return res.status(400).json({ success: false, message: 'Akun Google belum terhubung.' });
    }

    // Akun SSO murni tidak punya password lokal (password-nya JWT acak);
    // wajib set password dulu supaya tidak terkunci di luar akunnya sendiri.
    const hasLocalPassword = user.password && !user.password.startsWith('eyJ');
    if (!hasLocalPassword) {
      return res.status(400).json({
        success: false,
        message: 'Set password dulu sebelum memutus akun Google.',
      });
    }

    const updated = await userService.updateUser(authReq.user.id, { googleId: null });
    return res.json({ success: true, data: apiView.formatUser(updated) });
  } catch (error) {
    return next(error);
  }
};

// Daftar perangkat tempat akun login
const listDevices: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as typeof req & { user?: any };
    const devices = await prisma.loginDevice.findMany({
      where: { userId: authReq.user.id },
      orderBy: { lastActiveAt: 'desc' },
    });
    const currentJti = (authReq.user as any).jti;
    return res.json({
      success: true,
      data: devices.map((d) => ({ ...d, current: d.tokenId === currentJti })),
    });
  } catch (error) {
    return next(error);
  }
};

// Logout satu perangkat (params deviceId) atau semua (body: {all: true})
const revokeDevice: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as typeof req & { user?: any; body: Record<string, any> };
    const userId = authReq.user.id;
    const currentJti = (authReq.user as any).jti;

    if (authReq.body?.all) {
      const result = await prisma.loginDevice.deleteMany({ where: { userId } });
      return res.json({ success: true, data: { revoked: result.count, currentToo: true } });
    }

    const id = Number(req.params?.deviceId ?? authReq.body?.deviceId);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ success: false, message: 'deviceId tidak valid.' });
    }

    const device = await prisma.loginDevice.findFirst({ where: { id, userId } });
    if (!device) {
      return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
    }

    await prisma.loginDevice.delete({ where: { id } });

    if (device.tokenId === currentJti) {
      return res.json({ success: true, data: { revoked: 1, currentToo: true } });
    }
    return res.json({ success: true, data: { revoked: 1, currentToo: false } });
  } catch (error) {
    return next(error);
  }
};

export default {
  getProfile,
  updateProfile,
  startGoogleConnect,
  disconnectGoogle,
  listDevices,
  revokeDevice,
};
