'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, ShieldCheck, LogOut, Loader2, Check, Camera, Smartphone, Monitor, Trash2, Link2, Link2Off, Globe, RefreshCw } from 'lucide-react';
import DashboardShell from '@/app/components/DashboardShell';
import { useSession } from '@/app/session';
import { roleLabels } from '@/app/components/dashboard-shared';
import { money } from '@/app/components/ClaimTable';
import { listDevices, revokeDevice, revokeAllDevices, LoginDevice } from '@/app/actions/reimbursements';

const deviceLabel = (ua: string | null) => {
  if (!ua) return 'Perangkat tidak dikenal';
  const isMobile = /Android|iPhone|iPad|Mobile/i.test(ua);
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox'
    : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Mac OS/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : 'OS tidak dikenal';
  return `${browser} di ${os}`;
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'baru saja';
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
};

export default function ProfilePage() {
  const { user, claims, changePassword, updateProfile, disconnectGoogle, logout } = useSession();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  // Edit profil
  const [name, setName] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  // Google
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleMsg, setGoogleMsg] = useState('');

  // Devices
  const [devices, setDevices] = useState<LoginDevice[]>([]);
  const [devicesBusy, setDevicesBusy] = useState(false);
  const [devicesError, setDevicesError] = useState('');

  // Semua hook sebelum guard early-return (aturan React hooks)
  const stats = useMemo(() => {
    if (!user) return { count: 0, total: 0, approved: 0, paid: 0 };
    const scope = user.role === 'EMPLOYEE' ? claims.filter((c) => c.employeeEmail === user.email) : claims;
    const total = scope.reduce((sum, c) => sum + c.amount, 0);
    const approved = scope.filter((c) => ['MANAGER_APPROVED', 'FINANCE_REVIEW', 'READY_FOR_PAYMENT', 'PAID'].includes(c.status)).length;
    const paid = scope.filter((c) => c.status === 'PAID').length;
    return { count: scope.length, total, approved, paid };
  }, [claims, user]);

  useEffect(() => {
    if (user) setName(user.name);
  }, [user?.name]);

  const loadDevices = async () => {
    if (!user) return;
    setDevicesError('');
    try {
      setDevices(await listDevices(localStorage.getItem('reimbursement_token') || ''));
    } catch (err) {
      setDevicesError(err instanceof Error ? err.message : 'Gagal memuat perangkat.');
    }
  };

  useEffect(() => {
    if (user) loadDevices();
  }, [user?.id]);

  // Tangkap error connect Google dari callback (?googleError=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const googleError = params.get('googleError');
    if (googleError) {
      setGoogleMsg(googleError);
      window.history.replaceState({}, '', '/profile');
    }
  }, []);

  if (!user) return null;

  const initials = user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const avatarSrc = removeAvatar ? null : (avatarPreview || user.avatarUrl || null);

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

  const submitProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileBusy(true);
    try {
      await updateProfile({ name, avatar: avatarFile, removeAvatar });
      setAvatarFile(null);
      setAvatarPreview(null);
      setRemoveAvatar(false);
      if (fileInput.current) fileInput.current.value = '';
      setProfileSuccess('Profil berhasil diperbarui.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Profil gagal diperbarui.');
    } finally {
      setProfileBusy(false);
    }
  };

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setRemoveAvatar(false);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const connectGoogle = () => {
    const token = localStorage.getItem('reimbursement_token') || '';
    // Buka lewat form POST supaya token pembawa terkirim (route butuh auth)
    const formEl = document.createElement('form');
    formEl.method = 'POST';
    formEl.action = '/auth/google/connect';
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'token';
    input.value = token;
    formEl.appendChild(input);
    document.body.appendChild(formEl);
    formEl.submit();
  };

  const doDisconnectGoogle = async () => {
    setGoogleBusy(true);
    setGoogleMsg('');
    try {
      await disconnectGoogle();
      setGoogleMsg('Akun Google diputus.');
    } catch (err) {
      setGoogleMsg(err instanceof Error ? err.message : 'Gagal memutus akun Google.');
    } finally {
      setGoogleBusy(false);
    }
  };

  const doRevoke = async (deviceId: number) => {
    setDevicesBusy(true);
    try {
      const result = await revokeDevice(localStorage.getItem('reimbursement_token') || '', deviceId);
      if (result.currentToo) {
        logout();
        return;
      }
      await loadDevices();
    } catch (err) {
      setDevicesError(err instanceof Error ? err.message : 'Gagal mengeluarkan perangkat.');
    } finally {
      setDevicesBusy(false);
    }
  };

  const doRevokeAll = async () => {
    setDevicesBusy(true);
    try {
      await revokeAllDevices(localStorage.getItem('reimbursement_token') || '');
      logout();
    } catch (err) {
      setDevicesError(err instanceof Error ? err.message : 'Gagal mengeluarkan semua perangkat.');
      setDevicesBusy(false);
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
              <span className="-mt-8 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-4 border-card bg-brand text-xl font-bold text-ink">
                {avatarSrc
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarSrc} alt="Foto profil" className="size-full object-cover" />
                  : initials}
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
        {/* Edit profil */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Camera className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Edit profil</h3>
              <p className="text-xs text-muted-foreground">Nama lengkap & foto profil.</p>
            </div>
          </div>

          <form onSubmit={submitProfile} className="mt-5 space-y-4">
            <div className="flex items-center gap-4">
              <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted text-lg font-bold text-ink">
                {avatarSrc
                  ? // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarSrc} alt="Foto profil" className="size-full object-cover" />
                  : initials}
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="rounded-lg border border-input px-3 py-1.5 text-xs font-semibold transition hover:bg-muted"
                >
                  Pilih foto
                </button>
                {(avatarFile || user.avatarUrl) && !removeAvatar && (
                  <button
                    type="button"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      setRemoveAvatar(true);
                      if (fileInput.current) fileInput.current.value = '';
                    }}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    Hapus foto
                  </button>
                )}
                <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPickAvatar} />
              </div>
            </div>

            <label className="block text-sm font-medium">
              Nama lengkap
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-card"
                placeholder="Nama lengkap"
                required
              />
            </label>

            {profileError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{profileError}</p>}
            {profileSuccess && (
              <p className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <Check className="size-3.5" /> {profileSuccess}
              </p>
            )}

            <button
              type="submit"
              disabled={profileBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/80 disabled:opacity-60"
            >
              {profileBusy && <Loader2 className="size-4 animate-spin" />}
              {profileBusy ? 'Menyimpan...' : 'Simpan profil'}
            </button>
          </form>
        </section>

        {/* Akun Google */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Globe className="size-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold">Akun Google</h3>
              <p className="text-xs text-muted-foreground">Masuk cepat dengan Google SSO.</p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-border bg-muted/50 px-4 py-3">
            <p className="text-sm font-medium">
              {user.googleId ? 'Terhubung' : 'Belum terhubung'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {user.googleId
                ? 'Kamu bisa masuk pakai password atau akun Google.'
                : 'Hubungkan untuk login satu klik dengan Google.'}
            </p>
          </div>

          {googleMsg && (
            <p className={`mt-3 rounded-lg border px-3 py-2 text-xs ${googleMsg.includes('diputus') || googleMsg.includes('terhubung') ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-600'}`}>
              {googleMsg}
            </p>
          )}

          {user.googleId ? (
            <button
              type="button"
              onClick={doDisconnectGoogle}
              disabled={googleBusy}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              {googleBusy ? <Loader2 className="size-4 animate-spin" /> : <Link2Off className="size-4" />}
              Putuskan akun Google
            </button>
          ) : (
            <button
              type="button"
              onClick={connectGoogle}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-input px-4 py-2.5 text-sm font-semibold transition hover:bg-muted"
            >
              <Link2 className="size-4" />
              Hubungkan akun Google
            </button>
          )}
          {user.googleId && (
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              Untuk memutus, pastikan kamu sudah set password lokal (kartu Ubah password).
            </p>
          )}
        </section>

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

        {/* Perangkat login */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Smartphone className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">Perangkat login</h3>
                <p className="text-xs text-muted-foreground">Tempat akun kamu masuk.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadDevices}
              aria-label="Muat ulang"
              className="rounded-lg border border-input p-2 text-muted-foreground transition hover:bg-muted"
            >
              <RefreshCw className="size-3.5" />
            </button>
          </div>

          {devicesError && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{devicesError}</p>}

          <ul className="mt-4 space-y-2.5">
            {devices.length === 0 && (
              <li className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                Belum ada perangkat tercatat.
              </li>
            )}
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-muted-foreground">
                    {/Mobile|Android|iPhone/i.test(d.userAgent || '') ? <Smartphone className="size-4" /> : <Monitor className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {deviceLabel(d.userAgent)}
                      {d.current && (
                        <span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                          Perangkat ini
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {d.ip || 'IP tidak diketahui'} · aktif {timeAgo(d.lastActiveAt)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => doRevoke(d.id)}
                  disabled={devicesBusy}
                  aria-label={`Keluar dari ${deviceLabel(d.userAgent)}`}
                  className="rounded-lg border border-red-200 p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {devices.length > 0 && (
            <button
              type="button"
              onClick={doRevokeAll}
              disabled={devicesBusy}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              {devicesBusy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
              Keluar dari semua perangkat
            </button>
          )}
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
