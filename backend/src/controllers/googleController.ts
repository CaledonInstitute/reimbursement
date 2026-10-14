import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import config from '../config';
import authService from '../services/authService';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// Redirect URI harus sama persis dengan yang terdaftar di Google Cloud Console
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
  || 'https://feels-significant-replaced-forecast.trycloudflare.com/auth/google/callback';

const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authorizeUrl = (state: string) => {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('access_type', 'online');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);
  return url.toString();
};

// Mulai alur OAuth: redirect browser ke consent screen Google
const googleStart = (_req: Request, res: Response) => {
  const state = jwt.sign({ ts: Date.now() }, config.jwtSecret, { expiresIn: '10m' });
  return res.redirect(authorizeUrl(state));
};

const finishHtml = (appUrl: string, payload: any) => `<!doctype html><html><body><script>
      (function(){
        var payload = ${JSON.stringify(payload)};
        if (window.opener) {
          window.opener.postMessage(payload, '*');
          document.title = 'sent';
        } else {
          localStorage.setItem('reimbursement_token', payload.token);
          localStorage.setItem('reimbursement_user', JSON.stringify(payload.user));
          window.location.replace('${appUrl}/dashboard');
        }
      })();
    </script></body></html>`;

// Callback: tukar code dengan token, verifikasi, cari/buat user, terbitkan JWT app
const googleCallback = async (req: Request, res: Response) => {
  const appUrl = process.env.APP_URL || 'http://localhost:3000';
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) throw new Error('Kode otorisasi Google tidak ditemukan.');

    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token as string,
      audience: CLIENT_ID,
    });
    const profile = ticket.getPayload();
    if (!profile?.email) throw new Error('Email Google tidak tersedia.');

    const email = profile.email.toLowerCase();

    // state bisa berisi connectUserId (flow CONNECT dari halaman profil)
    let connectUserId: number | null = null;
    try {
      const state: any = jwt.verify(String(req.query.state || ''), config.jwtSecret);
      if (state?.connectUserId) connectUserId = Number(state.connectUserId);
    } catch { /* state login biasa atau tidak ada */ }

    let user;
    let appToken = '';

    if (connectUserId) {
      // CONNECT: kaitkan Google ke user yang sedang login
      user = await prisma.user.findUnique({ where: { id: connectUserId } });
      if (!user) throw new Error('Sesi tidak valid, coba lagi.');

      // Satu akun Google hanya boleh dipakai satu akun app
      const clash = await prisma.user.findFirst({ where: { googleId: profile.sub, NOT: { id: user.id } } });
      if (clash) throw new Error('Akun Google ini sudah terhubung ke akun lain.');
      const emailClash = await prisma.user.findFirst({ where: { email, NOT: { id: user.id } } });
      if (emailClash) throw new Error('Email Google ini sudah dipakai akun lain.');

      user = await prisma.user.update({ where: { id: user.id }, data: { googleId: profile.sub } });
      const issued = authService.createToken(user);
      appToken = issued.token;
      await authService.trackDevice(user, issued.jti, req);
    } else {
      user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        user = await prisma.user.create({
          data: {
            name: profile.name || email.split('@')[0],
            email,
            googleId: profile.sub,
            // Akun SSO tidak punya password lokal; string acak agar tidak bisa ditebak
            password: jwt.sign({ sso: true }, config.jwtSecret),
            role: 'EMPLOYEE',
          },
        });
      }

      const issued = authService.createToken(user);
      appToken = issued.token;
      await authService.trackDevice(user, issued.jti, req);
    }

    const payload = {
      user: authService.publicUser(user),
      token: appToken,
    };
    res.setHeader('Content-Type', 'text/html');
    return res.send(finishHtml(appUrl, payload));
  } catch (error: any) {
    return res.redirect(`${appUrl}/profile?googleError=${encodeURIComponent(error.message || 'SSO Google gagal.')}`);
  }
};

export default { googleStart, googleCallback };
