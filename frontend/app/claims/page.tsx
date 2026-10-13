'use client';

import { useMemo, useState } from 'react';
import { Search, Eye } from 'lucide-react';
import DashboardShell from '@/app/components/DashboardShell';
import { useSession } from '@/app/session';
import { ClaimTable, money, formatDate, StatusBadge } from '@/app/components/ClaimTable';
import { createClaim, updateClaim, uploadReceipt, submitClaim, deleteClaim, managerReview, financeReview, processPayment, uploadPaymentProof } from '@/app/actions/reimbursements';

const FILTERS: Record<string, (status: string) => boolean> = {
  Semua: () => true,
  Menunggu: (s) => ['SUBMITTED', 'MANAGER_APPROVED', 'FINANCE_REVIEW', 'REVISION_REQUIRED'].includes(s),
  Disetujui: (s) => ['MANAGER_APPROVED', 'FINANCE_REVIEW', 'READY_FOR_PAYMENT', 'PAID'].includes(s),
  'Siap bayar': (s) => s === 'READY_FOR_PAYMENT',
  Ditolak: (s) => s === 'REJECTED',
  Paid: (s) => s === 'PAID',
};

export default function ClaimsPage() {
  const { user, token, claims, loadClaims } = useSession();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Semua');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<any | null>(null);
  const [decision, setDecision] = useState<{ open: boolean; id: number | null; action: 'reject' | 'revise'; reason: string }>({ open: false, id: null, action: 'reject', reason: '' });
  const [payment, setPayment] = useState<{ open: boolean; id: number | null; reference: string; method: string; note: string; file: File | null }>({ open: false, id: null, reference: '', method: 'BANK_TRANSFER', note: '', file: null });

  const scope = user ? (user.role === 'EMPLOYEE' ? claims.filter((c) => c.employeeEmail === user.email) : claims) : [];

  const filtered = useMemo(() => scope.filter((claim) => {
    const haystack = `${claim.employeeName} ${claim.description} ${claim.category} ${claim.id}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && FILTERS[filter]?.(claim.status);
  }), [scope, query, filter]);

  if (!user) return null;

  const refresh = async () => { await loadClaims(); };

  const submitDecision = async () => {
    if (decision.id === null) return;
    const reason = decision.reason.trim();
    if (!reason) { setError('Alasan wajib diisi.'); return; }
    setError('');
    try {
      if (user.role === 'MANAGER') {
        await managerReview(token, decision.id, decision.action, reason);
      } else if (user.role === 'FINANCE') {
        await financeReview(token, decision.id, decision.action, reason);
      }
      setDecision({ open: false, id: null, action: 'reject', reason: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aksi gagal.');
    }
  };

  const submitPayment = async () => {
    if (payment.id === null) return;
    if (!payment.reference.trim()) { setError('Nomor referensi wajib diisi.'); return; }
    setError('');
    try {
      await processPayment(token, payment.id, payment.method as any, payment.reference.trim(), payment.note.trim() || undefined);
      if (payment.file) await uploadPaymentProof(token, payment.id, payment.file);
      setPayment({ open: false, id: null, reference: '', method: 'BANK_TRANSFER', note: '', file: null });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pembayaran gagal.');
    }
  };

  const act = async (fn: () => Promise<unknown>) => {
    setError('');
    try { await fn(); await refresh(); } catch (err) { setError(err instanceof Error ? err.message : 'Aksi gagal.'); }
  };

  const availableFilters = user.role === 'FINANCE' ? ['Semua', 'Menunggu', 'Siap bayar', 'Ditolak', 'Paid'] : ['Semua', 'Menunggu', 'Disetujui', 'Ditolak', 'Paid'];

  return (
    <DashboardShell title="Pengajuan">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Daftar pengajuan</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {user.role === 'EMPLOYEE' ? 'Semua reimbursement yang kamu ajukan.' : user.role === 'MANAGER' ? 'Pengajuan menunggu keputusan manager.' : 'Pengajuan menunggu verifikasi finance.'}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-input bg-card px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pengajuan..."
            className="w-44 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto">
        {availableFilters.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              filter === tab ? 'bg-ink text-white' : 'bg-card text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <div className="mt-4">
        {user.role === 'EMPLOYEE' ? (
          <EmployeeClaimList claims={filtered} onDetail={setDetail} onError={setError} token={token} refresh={refresh} />
        ) : (
          <ReviewClaimList
            claims={filtered}
            role={user.role}
            onDetail={setDetail}
            onDecision={(id, action) => setDecision({ open: true, id, action, reason: '' })}
            onPayment={(id) => setPayment({ open: true, id, reference: '', method: 'BANK_TRANSFER', note: '', file: null })}
            token={token}
            refresh={refresh}
            onError={setError}
          />
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={() => setDetail(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">Pengajuan #{detail.id}</p>
                <h3 className="mt-1 text-xl font-semibold">{detail.description || 'Tanpa deskripsi'}</h3>
              </div>
              <StatusBadge status={detail.status} />
            </div>
            <dl className="mt-5 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Pengaju</dt><dd className="font-medium">{detail.employeeName}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Kategori</dt><dd className="font-medium">{detail.category}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Tanggal</dt><dd className="font-medium">{formatDate(detail.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Jumlah</dt><dd className="font-semibold">{money(detail.amount)}</dd></div>
            </dl>
            {detail.history && detail.history.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <p className="text-xs font-semibold text-muted-foreground">Riwayat status</p>
                <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                  {[...detail.history].reverse().map((h: any, i: number) => (
                    <li key={i} className="flex gap-2">
                      <StatusBadge status={h.status ?? ''} />
                      {h.note && <span className="min-w-0 flex-1 truncate">{h.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={() => setDetail(null)} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/80">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Decision modal */}
      {decision.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={() => setDecision({ open: false, id: null, action: 'reject', reason: '' })}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold">{decision.action === 'reject' ? 'Alasan penolakan' : 'Alasan revisi'}</h3>
            <textarea
              value={decision.reason}
              onChange={(e) => setDecision((c) => ({ ...c, reason: e.target.value }))}
              rows={4}
              className="mt-4 w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-sm outline-none focus:border-ink focus:bg-card"
              placeholder="Jelaskan alasan untuk employee..."
            />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDecision({ open: false, id: null, action: 'reject', reason: '' })} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Batal</button>
              <button type="button" onClick={submitDecision} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${decision.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
                Kirim {decision.action === 'reject' ? 'penolakan' : 'revisi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment modal */}
      {payment.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4" onClick={() => setPayment({ open: false, id: null, reference: '', method: 'BANK_TRANSFER', note: '', file: null })}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-semibold">Proses pembayaran</h3>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-medium">
                Metode
                <select
                  value={payment.method}
                  onChange={(e) => setPayment((c) => ({ ...c, method: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-sm outline-none focus:border-ink focus:bg-card"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Tunai</option>
                  <option value="OTHER">Lainnya</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Nomor referensi
                <input
                  value={payment.reference}
                  onChange={(e) => setPayment((c) => ({ ...c, reference: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-sm outline-none focus:border-ink focus:bg-card"
                  placeholder="BTR-20261012-001"
                />
              </label>
              <label className="block text-sm font-medium">
                Bukti transfer (opsional)
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => setPayment((c) => ({ ...c, file: e.target.files?.[0] ?? null }))}
                  className="mt-1.5 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-semibold"
                />
              </label>
              <label className="block text-sm font-medium">
                Catatan
                <textarea
                  value={payment.note}
                  onChange={(e) => setPayment((c) => ({ ...c, note: e.target.value }))}
                  rows={3}
                  className="mt-1.5 w-full rounded-lg border border-input bg-muted px-3 py-2.5 text-sm outline-none focus:border-ink focus:bg-card"
                  placeholder="Catatan pembayaran..."
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPayment({ open: false, id: null, reference: '', method: 'BANK_TRANSFER', note: '', file: null })} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Batal</button>
              <button type="button" onClick={submitPayment} className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink/80">Konfirmasi bayar</button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function EmployeeClaimList({ claims, onDetail, onError, token, refresh }: any) {
  const act = async (fn: () => Promise<unknown>) => {
    onError('');
    try { await fn(); await refresh(); } catch (err) { onError(err instanceof Error ? err.message : 'Aksi gagal.'); }
  };

  return (
    <div className="space-y-2">
      {claims.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">Belum ada pengajuan.</div>
      )}
      {claims.map((claim: any) => (
        <div key={claim.id} className="rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{claim.description || `Pengajuan #${claim.id}`}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">#{claim.id} · {claim.category} · {formatDate(claim.createdAt)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{money(claim.amount)}</span>
              <StatusBadge status={claim.status} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onDetail(claim)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-foreground/80 hover:bg-muted">
              <Eye className="size-3" /> Detail
            </button>
            {['DRAFT', 'REVISION_REQUIRED'].includes(claim.status) && (
              <label className="cursor-pointer rounded-lg border border-input bg-muted px-2.5 py-1.5 text-[11px] font-semibold text-foreground/80 hover:bg-accent hover:text-accent-foreground">
                {claim.receiptUrl ? 'Ganti bukti & submit' : 'Unggah bukti & submit'}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    act(async () => {
                      await uploadReceipt(token, claim.id, file);
                      await submitClaim(token, claim.id);
                    });
                  }}
                />
              </label>
            )}
            {['DRAFT', 'REVISION_REQUIRED'].includes(claim.status) && (
              <button
                type="button"
                onClick={() => act(async () => { await deleteClaim(token, claim.id); })}
                className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-100"
              >
                Hapus
              </button>
            )}
            {claim.status === 'REJECTED' && (
              <span className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600">
                {claim.history?.slice().reverse().find((h: any) => h.status === 'REJECTED')?.note || 'Ditolak manager.'}
              </span>
            )}
            {claim.status === 'REVISION_REQUIRED' && (
              <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-700">
                {claim.history?.slice().reverse().find((h: any) => h.status === 'REVISION_REQUIRED')?.note || 'Perlu revisi.'}
              </span>
            )}
            {claim.status === 'PAID' && claim.payment?.proofUrl && (
              <a href={claim.payment.proofUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">
                Lihat bukti bayar
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewClaimList({ claims, role, onDetail, onDecision, onPayment, token, refresh, onError }: any) {
  const act = async (fn: () => Promise<unknown>) => {
    onError('');
    try { await fn(); await refresh(); } catch (err) { onError(err instanceof Error ? err.message : 'Aksi gagal.'); }
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-5 py-3">Pengaju</th>
            <th className="px-4 py-3">Deskripsi</th>
            <th className="px-4 py-3">Jumlah</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-5 py-3">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {claims.length === 0 && (
            <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">Tidak ada pengajuan sesuai filter.</td></tr>
          )}
          {claims.map((claim: any) => (
            <tr key={claim.id} className="border-b border-border last:border-0 hover:bg-muted/60">
              <td className="px-5 py-4">
                <p className="font-medium">{claim.employeeName}</p>
                <p className="text-xs text-muted-foreground">{claim.employeeEmail}</p>
              </td>
              <td className="max-w-[240px] px-4 py-4">
                <p className="truncate">{claim.description || '—'}</p>
                <p className="text-xs text-muted-foreground">{claim.category}</p>
              </td>
              <td className="px-4 py-4 font-semibold">{money(claim.amount)}</td>
              <td className="px-4 py-4"><StatusBadge status={claim.status} /></td>
              <td className="px-5 py-4">
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => onDetail(claim)} className="rounded-lg border border-border px-2 py-1.5 text-[11px] font-semibold text-foreground/80 hover:bg-muted">Detail</button>
                  {role === 'MANAGER' && claim.status === 'SUBMITTED' && (
                    <button type="button" onClick={() => act(() => managerReview(token, claim.id, 'approve', 'Disetujui manager'))} className="rounded-lg bg-emerald-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600">Approve</button>
                  )}
                  {role === 'MANAGER' && claim.status === 'SUBMITTED' && (
                    <>
                      <button type="button" onClick={() => onDecision(claim.id, 'revise')} className="rounded-lg bg-amber-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600">Revisi</button>
                      <button type="button" onClick={() => onDecision(claim.id, 'reject')} className="rounded-lg bg-red-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600">Tolak</button>
                    </>
                  )}
                  {role === 'FINANCE' && claim.status === 'MANAGER_APPROVED' && (
                    <button type="button" onClick={() => act(() => financeReview(token, claim.id, 'start'))} className="rounded-lg bg-ink px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-ink/80">Mulai verifikasi</button>
                  )}
                  {role === 'FINANCE' && claim.status === 'FINANCE_REVIEW' && (
                    <>
                      <button type="button" onClick={() => act(() => financeReview(token, claim.id, 'verify', 'Terverifikasi finance'))} className="rounded-lg bg-emerald-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-600">Setujui</button>
                      <button type="button" onClick={() => onDecision(claim.id, 'revise')} className="rounded-lg bg-amber-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-amber-600">Revisi</button>
                      <button type="button" onClick={() => onDecision(claim.id, 'reject')} className="rounded-lg bg-red-500 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-red-600">Tolak</button>
                    </>
                  )}
                  {role === 'FINANCE' && claim.status === 'READY_FOR_PAYMENT' && (
                    <button type="button" onClick={() => onPayment(claim.id)} className="rounded-lg bg-brand px-2 py-1.5 text-[11px] font-semibold text-ink hover:bg-brand-strong hover:text-white">Bayar</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
