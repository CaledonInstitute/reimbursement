'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useSession } from '@/app/session';
import { roleLabels } from '@/app/components/dashboard-shared';

type NavItem = { href: string; label: string; icon: React.ReactNode };

const iconClass = 'size-[18px]';

function navFor(role: string): NavItem[] {
  const base: NavItem[] = [
    {
      href: '/dashboard',
      label: 'Ringkasan',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
          <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
        </svg>
      ),
    },
    {
      href: '/claims',
      label: 'Pengajuan',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
          <path d="M6 2.5h8.5L19 7v14.5H6z" />
          <path d="M14 2.5V7h5M9 12h6M9 16h6" />
        </svg>
      ),
    },
  ];

  if (role === 'EMPLOYEE') {
    base.push({
      href: '/claims/new',
      label: 'Ajukan baru',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v8M8 12h8" />
        </svg>
      ),
    });
  }

  base.push({
    href: '/profile',
    label: 'Profil & keamanan',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={iconClass}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
      </svg>
    ),
  });

  return base;
}

function Logo({ className = '', variant = 'light' }: { className?: string; variant?: 'light' | 'dark' }) {
  // light = logo asli (putih) untuk background gelap; dark = terinvert untuk background putih
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={variant === 'dark' ? '/microdata-logo-dark.png' : '/microdata-logo.png'}
        alt="Microdata Indonesia"
        className="h-9 w-auto"
      />
    </span>
  );
}

export function DashboardShell({ children, title }: { children: React.ReactNode; title: string }) {
  const { user, logout } = useSession();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const items = navFor(user.role);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar tetap di tempat — bukan dock mengambang */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-[248px] flex-col bg-ink lg:flex">
        <Link href="/dashboard" className="flex h-[72px] items-center px-5">
          <Logo />
        </Link>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  active
                    ? 'bg-sidebar-accent font-semibold text-white'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-white'
                }`}
              >
                {active && (
                  <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand" aria-hidden />
                )}
                <span className={active ? 'text-brand' : ''}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-ink">
              {user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user.name}</p>
              <p className="text-[11px] text-sidebar-foreground">{roleLabels[user.role]}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-3 w-full rounded-lg border border-sidebar-border px-3 py-2 text-xs font-semibold text-sidebar-foreground transition hover:bg-sidebar-accent hover:text-white"
          >
            Keluar
          </button>
        </div>
      </aside>

      {/* Topbar mobile: satu baris + hamburger, menu slide-down */}
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4 sm:px-8">
            <Link href="/dashboard">
              <Logo variant="dark" />
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden text-sm font-semibold tracking-tight sm:block">{title}</span>
              <button
                type="button"
                aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="flex size-10 items-center justify-center rounded-lg text-foreground transition hover:bg-muted"
              >
                {menuOpen ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
                    <path d="M4 7h16M4 12h16M4 17h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {menuOpen && (
            <nav className="border-t border-border bg-card px-2 pb-3 pt-2 lg:hidden">
              {items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition ${
                      active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <span className={active ? 'text-brand-strong' : ''}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
              <div className="mt-2 flex items-center gap-3 border-t border-border px-3 pt-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">
                  {user.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold">{user.name}</p>
                  <p className="text-[11px] text-muted-foreground">{roleLabels[user.role]}</p>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Keluar
                </button>
              </div>
            </nav>
          )}
        </header>

        <main className="mx-auto max-w-[1200px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}

export default DashboardShell;
