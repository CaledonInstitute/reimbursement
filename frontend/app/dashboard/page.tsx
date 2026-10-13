'use client';

import Link from 'next/link';
import DashboardShell from '@/app/components/DashboardShell';
import { useSession } from '@/app/session';
import { money, formatDate, StatusBadge } from '@/app/components/ClaimTable';

function StatCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-3 text-xl font-semibold tracking-tight">{value}</p>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">{note}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, claims } = useSession();

  if (!user) return null;

  const isEmployee = user.role === 'EMPLOYEE';
  const scope = isEmployee ? claims.filter((c) => c.employeeEmail === user.email) : claims;

  const total = scope.reduce((sum, c) => sum + c.amount, 0);
  const waiting = scope.filter((c) => ['SUBMITTED', 'MANAGER_APPROVED', 'FINANCE_REVIEW', 'REVISION_REQUIRED'].includes(c.status)).length;
  const ready = scope.filter((c) => c.status === 'READY_FOR_PAYMENT').length;
  const paid = scope.filter((c) => c.status === 'PAID').length;
  const rejected = scope.filter((c) => c.status === 'REJECTED').length;

  const recent = [...scope].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);

  return (
    <DashboardShell title="Ringkasan">
      <p className="text-sm text-muted-foreground">
        {isEmployee ? 'Pantau pengajuan reimburse kamu.' : user.role === 'MANAGER' ? 'Tinjau pengajuan dari tim kamu.' : 'Kelola pembayaran reimburse perusahaan.'}
      </p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">
        {isEmployee ? 'Dashboard Employee' : user.role === 'MANAGER' ? 'Dashboard Manager' : 'Dashboard Finance'}
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Total klaim" value={money(total)} note="Akumulasi seluruh pengajuan" />
        <StatCard label="Sedang diproses" value={`${waiting} item`} note="Menunggu keputusan" />
        <StatCard label="Siap dibayar" value={`${ready} item`} note="Menunggu pembayaran finance" />
        <StatCard label="Selesai dibayar" value={`${paid} item`} note={rejected > 0 ? `${rejected} item ditolak` : 'Semua beres'} />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h3 className="font-semibold">Pengajuan terbaru</h3>
        <Link href="/claims" className="text-xs font-semibold text-brand-strong hover:underline">
          Lihat semua
        </Link>
      </div>

      <div className="mt-3 space-y-2">
        {recent.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            Belum ada pengajuan.
          </div>
        )}
        {recent.map((claim) => (
          <div key={claim.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{claim.description || `Pengajuan #${claim.id}`}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {claim.employeeName} · {formatDate(claim.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-4">
              <span className="text-sm font-semibold">{money(claim.amount)}</span>
              <StatusBadge status={claim.status} />
            </div>
          </div>
        ))}
      </div>
    </DashboardShell>
  );
}
