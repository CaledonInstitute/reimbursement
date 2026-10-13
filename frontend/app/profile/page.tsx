'use client';

import { useMemo, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, LogOut, Loader2, Check } from 'lucide-react';
import DashboardShell from '@/app/components/DashboardShell';
import { useSession } from '@/app/session';
import { roleLabels } from '@/app/components/dashboard-shared';
import { money } from '@/app/components/ClaimTable';

export default function ProfilePage() {
  const { user, claims, changePassword, logout } = useSession();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  // Semua hook sebelum guard early-return (aturan React hooks)
  const stats = useMemo(() => {
    if (!user) return { count: 0, total: 0, approved: 0, paid: 0 };
    const scope = user.role === 'EMPLOYEE' ? claims.filter((c) => c.employeeEmail === user.email) : claims;
    const total = scope.reduce((sum, c) => sum + c.amount, 0);
    const approved = scope.filter((c) => ['MANAGER_APPROVED', 'FINANCE_REVIEW', 'READY_FOR_PAYMENT', 'PAID'].includes(c.status)).length;
    const paid = scope.filter((c) => c.status === 'PAID').length;
    return { count: scope.length, total, approved, paid };
  }, [claims, user]);

  const initials = user
    ? user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '';

  if (!user) return null;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.next.length < 6) { setError('Password baru minimal 6 karakter.'); return; }
    if (form.next !== form.confirm) { setError('Konfirmasi password tidak sama.'); return; }

    setBusy(true);
    try {
      await changePassword(form.current, form.next);
      setSuccess('Password berhasil diubah.');
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password gagal diubah.');
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, key: 'current' | 'next' | 'confirm', placeholder: string) => (
    <label className="block text-sm font-medium">
      {label}
      <div className="relative mt-1.5">
        <input
          type={show[key] ? 'text' : 'password'}
          value={form[key]}
          onChange={(e) => setForm((c) => ({ ...c, [key]: e.target.value }))}
          className="w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 pr-10 text-sm outline-none transition focus:border-ink focus:bg-card"
          placeholder={placeholder}
          required
        />
        <button
          type="button"
          aria-label={show[key] ? 'Sembunyikan' : 'Tampilkan'}
          onClick={() => setShow((c) => ({ ...c, [key]: !c[key] }))}
          className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
        >
          {show[key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </label>
  );

  return (
    <DashboardShell title="Profil & keamanan">
      <h2 className="text-2xl font-semibold tracking-tight">Profil saya</h2>

      {/* Kartu identitas */}
      <section className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <div className="relative h-20 bg-ink">
          <svg className="absolute right-6 top-1/2 h-12 -translate-y-1/2 sm:block" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 2.5 20.2 7.25v9.5L12 21.5 3.8 16.75v-9.5L12 2.5Z" stroke="#F7941D" strokeWidth="1.2" strokeLinejoin="round" opacity="0.5" />
          </svg>
        </div>
        <div className="px-6 pb-6">
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <span className="-mt-8 flex size-16 shrink-0 items-center justify-center rounded-2xl border-4 border-card bg-brand text-xl font-bold text-ink">
                {initials}
              </span>
              <div className="min-w-0 pb-0.5">
                <p className="truncate text-lg font-semibold">{user.name}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <span className="mb-1 inline-flex items-center rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-accent-foreground">
              {roleLabels[user.role]}
            </span>
          </div>

          {/* Statistik akun */}
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Total pengajuan', `${stats.count}`],
              ['Nilai klaim', money(stats.total)],
              ['Disetujui', `${stats.approved}`],
              ['Dibayar', `${stats.paid}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-border bg-muted/50 px-4 py-3">
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
                <dd className="mt-1 truncate text-sm font-semibold tracking-tight">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Keamanan */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Ubah password</h3>
              <p className="text-xs text-muted-foreground">Minimal 6 karakter.</p>
            </div>
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {field('Password lama', 'current', 'Password saat ini')}
            {field('Password baru', 'next', 'Minimal 6 karakter')}
            {field('Konfirmasi password baru', 'confirm', 'Ulangi password baru')}

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
            {success && (
              <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <Check className="size-3.5" /> {success}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/80 disabled:opacity-60"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {busy ? 'Menyimpan...' : 'Simpan password baru'}
            </button>
          </form>
        </section>

        {/* Sesi */}
        <section className="flex flex-col rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <LogOut className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Sesi</h3>
              <p className="text-xs text-muted-foreground">Keluar dari perangkat ini.</p>
            </div>
          </div>

          <p className="mt-5 flex-1 text-xs leading-5 text-muted-foreground">
            Keluar hanya menghapus sesi di perangkat ini. Data pengajuan kamu tetap aman dan
            tersedia saat kamu masuk kembali.
          </p>

          <button
            type="button"
            onClick={logout}
            className="mt-4 w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            Keluar dari akun
          </button>
        </section>
      </div>
    </DashboardShell>
  );
}
