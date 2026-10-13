'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useSession } from '@/app/session';

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.3-2.1 3.7-5.2 3.7-8.6z" />
      <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.1 0-5.8-2.1-6.8-5l-3.9 3C3.3 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.4c-.2-.7-.4-1.5-.4-2.4s.2-1.7.4-2.4l-3.9-3C.5 8.2 0 10 0 12s.5 3.8 1.3 5.4l3.9-3z" />
      <path fill="#EA4335" d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1 15.2 0 12 0 7.3 0 3.3 2.7 1.3 6.6l3.9 3c1-2.9 3.7-4.9 6.8-4.9z" />
    </svg>
  );
}

export function GoogleButton({ label }: { label: string }) {
  return (
    <a
      href="/api/auth/google"
      className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-input bg-card px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-muted"
    >
      <GoogleIcon />
      {label}
    </a>
  );
}

export function Divider() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      atau
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export default function LoginPage() {
  const { user, ready, login } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ready && user) router.replace('/dashboard');
  }, [ready, user, router]);

  // Tangkap pesan error SSO dari redirect (?error=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoError = params.get('error');
    if (ssoError) setError(`SSO Google gagal: ${ssoError}`);
  }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autentikasi gagal. Coba lagi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border bg-card/90 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/microdata-logo-dark.png" alt="Microdata Indonesia" className="h-9 w-auto" />
          <Link
            href="/register"
            className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink/80"
          >
            Daftar
          </Link>
        </div>
      </nav>

      <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-[1200px] items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_400px]">
        <section className="hidden lg:block">
          <h1 className="max-w-[14ch] text-5xl font-semibold leading-[1.05] tracking-tight">
            Kelola reimburse tanpa kehilangan jejak.
          </h1>
          <p className="mt-5 max-w-[52ch] text-base leading-7 text-muted-foreground">
            Employee mengajukan, manager meninjau, finance memproses pembayaran —
            setiap langkah tercatat dan bisa dilacak.
          </p>

          <ol className="mt-10 space-y-4 border-l-2 border-brand pl-5">
            {[
              ['Ajukan', 'Employee membuat klaim dan melampirkan bukti.'],
              ['Tinjau', 'Manager menyetujui, meminta revisi, atau menolak.'],
              ['Bayar', 'Finance memverifikasi dan memproses pembayaran.'],
            ].map(([title, desc]) => (
              <li key={title}>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Masuk</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Gunakan email dan password akun kamu.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus(); } }}
                className="mt-1.5 w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-card"
                placeholder="email@perusahaan.com"
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Password
              <div className="relative mt-1.5">
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                  className="w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 pr-10 text-sm outline-none transition focus:border-ink focus:bg-card"
                  placeholder="Minimal 6 karakter"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/80 disabled:opacity-60"
            >
              {busy ? 'Memproses...' : 'Masuk'}
            </button>
          </form>

          <div className="mt-4">
            <Divider />
          </div>

          <div className="mt-4">
            <GoogleButton label="Masuk dengan Google" />
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Belum punya akun?{' '}
            <Link href="/register" className="font-semibold text-brand-strong hover:underline">
              Daftar sekarang
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
