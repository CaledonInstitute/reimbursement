import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import config from '../config';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
// Redirect URI harus sama persis dengan yang terdaftar di Google Cloud Console
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
  || 'https://feels-significant-replaced-forecast.trycloudflare.com/auth/google/callback';

const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Mulai alur OAuth: redirect browser ke consent screen Google
const googleStart = (_req: Request, res: Response) => {
  const state = jwt.sign({ ts: Date.now() }, config.jwtSecret, { expiresIn: '10m' });
  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizeUrl.searchParams.set('client_id', CLIENT_ID);
  authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'openid email profile');
  authorizeUrl.searchParams.set('access_type', 'online');
  authorizeUrl.searchParams.set('prompt', 'select_account');
  authorizeUrl.searchParams.set('state', state);
  return res.redirect(authorizeUrl.toString());
};

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
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: profile.name || email.split('@')[0],
          email,
          // Akun SSO tidak punya password lokal; string acak agar tidak bisa ditebak
          password: jwt.sign({ sso: true }, config.jwtSecret),
          role: 'EMPLOYEE',
        },
      });
    }

    const appToken = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: '1d' },
    );

    // Postmessage popup flow / redirect flow: serahkan ke frontend via halaman kecil
    const payload = JSON.stringify({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      token: appToken,
    });
    res.setHeader('Content-Type', 'text/html');
    return res.send(`<!doctype html><html><body><script>
      (function(){
        var payload = ${payload};
        if (window.opener) {
          window.opener.postMessage(payload, '*');
          document.title = 'sent';
        } else {
          localStorage.setItem('reimbursement_token', payload.token);
          localStorage.setItem('reimbursement_user', JSON.stringify(payload.user));
          window.location.replace('${appUrl}/dashboard');
        }
      })();
    </script></body></html>`);
  } catch (error: any) {
    return res.redirect(`${appUrl}/login?error=${encodeURIComponent(error.message || 'SSO Google gagal.')}`);
  }
};

export default { googleStart, googleCallback };
