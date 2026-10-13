'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { UploadCloud, FileText, ArrowLeft, Check, Loader2 } from 'lucide-react';
import DashboardShell from '@/app/components/DashboardShell';
import { useSession } from '@/app/session';
import { createClaim, uploadReceipt, submitClaim } from '@/app/actions/reimbursements';
import { money } from '@/app/components/ClaimTable';

const CATEGORIES = [
  'Transportasi',
  'Makanan & Minuman',
  'Kesehatan',
  'Perjalanan Dinas',
  'Peralatan Kerja',
  'ATK & Office Supplies',
  'Pelatihan & Seminar',
];

// Langkah form: 1 detail -> 2 bukti -> 3 ringkasan
const STEPS = ['Detail pengeluaran', 'Bukti', 'Ringkasan'] as const;

export default function NewClaimPage() {
  const { user, token, loadClaims } = useSession();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const amountNumber = Number(amount || 0);
  const formattedAmount = useMemo(() => (amountNumber > 0 ? money(amountNumber) : ''), [amountNumber]);

  if (!user || user.role !== 'EMPLOYEE') {
    return (
      <DashboardShell title="Ajukan baru">
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Hanya employee yang bisa membuat pengajuan.
        </div>
      </DashboardShell>
    );
  }

  const detailValid = description.trim().length > 0 && amountNumber > 0;
  const canSubmit = detailValid && !!receipt;

  const pickFile = (file: File | null | undefined) => {
    if (!file) return;
    const ok = ['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) || /\.(jpe?g|png|pdf)$/i.test(file.name);
    if (!ok) { setError('Format tidak didukung. Gunakan JPG, PNG, atau PDF.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Ukuran file maksimal 5 MB.'); return; }
    setError('');
    setReceipt(file);
  };

  const submit = async (submitAfter: boolean) => {
    setError('');
    setBusy(true);
    try {
      const payload = {
        description,
        category,
        amount: amountNumber,
        expenses: [{
          category,
          amount: amountNumber,
          expenseDate: new Date().toISOString().slice(0, 10), // date-only: hindari clock skew device vs server
          description,
          receiptUrl: '',
        }],
      };

      const created = await createClaim(token, payload);
      const claimId = created?.id;
      if (receipt && claimId) {
        await uploadReceipt(token, claimId, receipt);
      }
      if (submitAfter && claimId) {
        await submitClaim(token, claimId);
      }
      await loadClaims();
      router.push('/claims');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pengajuan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardShell title="Ajukan baru">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Buat pengajuan reimbursement</h2>
          <p className="mt-1 text-sm text-muted-foreground">Isi detail pengeluaran dan lampirkan bukti yang sah.</p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/claims')}
          className="hidden items-center gap-1.5 rounded-lg border border-input px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground sm:inline-flex"
        >
          <ArrowLeft className="size-3.5" /> Kembali
        </button>
      </div>

      {/* Stepper */}
      <ol className="mx-auto mt-6 flex max-w-2xl items-center gap-2">
        {STEPS.map((label, i) => (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition ${
                i < step
                  ? 'bg-brand text-ink'
                  : i === step
                    ? 'bg-ink text-white'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {i < step ? <Check className="size-3.5" /> : i + 1}
            </span>
            <span className={`hidden text-xs font-medium sm:block ${i === step ? 'text-foreground' : 'text-muted-foreground'}`}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
          </li>
        ))}
      </ol>

      <form
        onSubmit={(e) => { e.preventDefault(); if (step === STEPS.length - 1) submit(true); }}
        className="mx-auto mt-5 max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-8"
      >
        {/* Step 1: Detail */}
        {step === 0 && (
          <div className="space-y-5">
            <label className="block text-sm font-medium">
              Deskripsi pengajuan
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-input bg-muted px-3.5 py-2.5 text-sm outline-none transition focus:border-ink focus:bg-card"
                placeholder="Contoh: Transport meeting klien"
                autoFocus
              />
            </label>

            <div>
              <p className="text-sm font-medium">Kategori</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                      category === c
                        ? 'border-ink bg-ink text-white'
                        : 'border-input bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <label className="block text-sm font-medium">
              Jumlah
              <div className="relative mt-1.5">
                <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm text-muted-foreground">Rp</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-input bg-muted py-2.5 pl-11 pr-3.5 text-sm outline-none transition focus:border-ink focus:bg-card"
                  placeholder="150.000"
                  min={1}
                  autoFocus
                />
              </div>
              {formattedAmount && (
                <span className="mt-1.5 block text-[11px] text-muted-foreground">={formattedAmount}</span>
              )}
            </label>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

            <div className="flex justify-end border-t border-border pt-4">
              <button
                type="button"
                disabled={!detailValid}
                onClick={() => { setError(''); setStep(1); }}
                className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/80 disabled:opacity-50"
              >
                Lanjut ke bukti
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Bukti */}
        {step === 1 && (
          <div className="space-y-5">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files?.[0]); }}
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${
                dragOver ? 'border-brand bg-accent/60' : 'border-border bg-muted/50'
              }`}
            >
              <span className="flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
                <UploadCloud className="size-5" />
              </span>
              <p className="mt-3 text-sm font-semibold">Tarik & lepas bukti di sini</p>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, atau PDF. Maksimal 5 MB.</p>
              <label className="mt-4 cursor-pointer rounded-lg bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink/80">
                Pilih file
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </label>
            </div>

            {receipt && (
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/60 px-4 py-3">
                <FileText className="size-4 shrink-0 text-brand-strong" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{receipt.name}</p>
                  <p className="text-[11px] text-muted-foreground">{(receipt.size / 1024).toFixed(0)} KB</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Hapus
                </button>
              </div>
            )}

            <div className="rounded-lg border border-accent-foreground/20 bg-accent px-4 py-3 text-xs leading-5 text-accent-foreground">
              Bukti wajib sebelum submit. Tanpa lampiran, manager tidak bisa meninjau pengajuan kamu.
            </div>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

            <div className="flex justify-between border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setStep(0)}
                className="rounded-lg border border-input px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                Kembali
              </button>
              <button
                type="button"
                disabled={!receipt}
                onClick={() => { setError(''); setStep(2); }}
                className="rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/80 disabled:opacity-50"
              >
                Lihat ringkasan
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Ringkasan */}
        {step === 2 && (
          <div className="space-y-5">
            <dl className="divide-y divide-border rounded-xl border border-border">
              {[
                ['Deskripsi', description],
                ['Kategori', category],
                ['Jumlah', money(amountNumber)],
                ['Bukti', receipt ? receipt.name : '—'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                  <dt className="shrink-0 text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>

            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() => submit(false)}
                className="rounded-lg border border-input px-4 py-2.5 text-sm font-semibold text-foreground/80 transition hover:bg-muted disabled:opacity-60"
              >
                Simpan sebagai draft
              </button>
              <button
                type="submit"
                disabled={busy || !canSubmit}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-ink/80 disabled:opacity-50"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? 'Memproses...' : 'Simpan & submit'}
              </button>
            </div>
          </div>
        )}
      </form>

      {/* Bantuan di bawah form */}
      <aside className="mx-auto mt-5 max-w-2xl rounded-2xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold">Yang perlu diperhatikan</h3>
        <ul className="mt-2.5 space-y-2 text-xs leading-5 text-muted-foreground">
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />Pengajuan tersimpan sebagai draft sampai kamu submit — manager baru bisa meninjau setelah itu.</li>
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />Bukti harus asli dan terbaca: struk, invoice, atau tiket.</li>
          <li className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />Kalau diminta revisi, ajukan yang sama bisa diunggah ulang buktinya tanpa buat baru.</li>
        </ul>
      </aside>
    </DashboardShell>
  );
}
