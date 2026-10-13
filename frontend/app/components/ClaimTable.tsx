'use client';

import { useState } from 'react';
import { useSession } from '@/app/session';

type ClaimRow = {
  id: number;
  employeeName: string;
  employeeEmail: string;
  category: string;
  description: string;
  amount: number;
  createdAt: string;
  status: string;
};

export const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  MANAGER_APPROVED: 'Manager approved',
  FINANCE_REVIEW: 'Finance review',
  READY_FOR_PAYMENT: 'Siap bayar',
  PAID: 'Paid',
  REJECTED: 'Rejected',
  REVISION_REQUIRED: 'Revisi',
};

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  MANAGER_APPROVED: 'bg-emerald-50 text-emerald-700',
  FINANCE_REVIEW: 'bg-violet-50 text-violet-700',
  READY_FOR_PAYMENT: 'bg-accent text-accent-foreground',
  PAID: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-red-50 text-red-700',
  REVISION_REQUIRED: 'bg-amber-50 text-amber-700',
};

export function money(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(value));
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none ${STATUS_CLASS[status] ?? 'bg-muted text-foreground'}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export default function ClaimTable({ claims, emptyText = 'Belum ada pengajuan.' }: { claims: ClaimRow[]; emptyText?: string }) {
  if (claims.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-sm font-medium text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th className="px-5 py-3">Pengaju</th>
            <th className="px-4 py-3">Deskripsi</th>
            <th className="px-4 py-3">Kategori</th>
            <th className="px-4 py-3">Tanggal</th>
            <th className="px-4 py-3">Jumlah</th>
            <th className="px-5 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {claims.map((claim) => (
            <tr key={claim.id} className="border-b border-border last:border-0 hover:bg-muted/60">
              <td className="px-5 py-4">
                <p className="font-medium">{claim.employeeName}</p>
                <p className="text-xs text-muted-foreground">#{claim.id}</p>
              </td>
              <td className="max-w-[260px] px-4 py-4 text-foreground/80">{claim.description || '—'}</td>
              <td className="px-4 py-4 text-muted-foreground">{claim.category}</td>
              <td className="px-4 py-4 text-muted-foreground">{formatDate(claim.createdAt)}</td>
              <td className="px-4 py-4 font-semibold">{money(claim.amount)}</td>
              <td className="px-5 py-4"><StatusBadge status={claim.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function useClaimActions() {
  const { token, loadClaims } = useSession();
  const [error, setError] = useState('');
  return { token, loadClaims, error, setError };
}
