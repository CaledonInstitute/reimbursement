'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { useEffect, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useSession } from '@/app/session';
import { GoogleButton, Divider } from '@/app/login/page';

export default function RegisterPage() {
  const { user, ready, register } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (ready && user) router.replace('/dashboard');
  }, [ready, user, router]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (form.password.length < 6) { setError('Password minimal 6 karakter.'); return; }
    if (form.password !== form.confirm) { setError('Konfirmasi password tidak sama.'); return; }

    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pendaftaran gagal. Coba lagi.');
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
            href="/login"
            className="rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink/80"
          >
            Masuk
          </Link>
        </div>
      </nav>

      <main className="mx-auto grid min-h-[calc(100vh-65px)] max-w-[1200px] items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_400px]">
        <section className="hidden lg:block">
          <h1 className="max-w-[14ch] text-5xl font-semibold leading-[1.05] tracking-tight">
            Mulai kelola reimburse tim kamu hari ini.
          </h1>
          <p className="mt-5 max-w-[52ch] text-base leading-7 text-muted-foreground">
            Daftar gratis, ajukan klaim pertama dalam hitungan menit.
            Akun baru otomatis berperan sebagai employee.
          </p>

          <ol className="mt-10 space-y-4 border-l-2 border-brand pl-5">
            {[
              ['Isi profil', 'Nama dan email kamu jadi identitas pengajuan.'],
              ['Buat klaim', 'Lampirkan bukti pengeluaran yang sah.'],
              ['Pantau status', 'Lacak dari manager sampai pembayaran.'],
            ].map(([title, desc]) => (
              <li key={title}>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight">Buat akun</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Akun baru otomatis berperan sebagai employee.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Nama lengkap
              <input
                value={form.name}
                onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-card"
                placeholder="Nama kamu"
                required
              />
            </label>

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

            <label className="block text-sm font-medium">
              Konfirmasi password
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.confirm}
                onChange={(e) => setForm((c) => ({ ...c, confirm: e.target.value }))}
                className="w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-card"
                placeholder="Ulangi password"
                required
              />
            </label>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-ink px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink/80 disabled:opacity-60"
            >
              {busy ? 'Memproses...' : 'Daftar sekarang'}
            </button>
          </form>

          <div className="mt-4">
            <Divider />
          </div>

          <div className="mt-4">
            <GoogleButton label="Daftar dengan Google" />
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Sudah punya akun?{' '}
            <Link href="/login" className="font-semibold text-brand-strong hover:underline">
              Masuk di sini
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
