'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { loginUser, registerUser, listClaims, updateProfilePassword, updateProfileName, disconnectGoogle as apiDisconnectGoogle } from '@/app/actions/reimbursements';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'FINANCE';
  avatarUrl?: string | null;
  googleId?: string | null;
};

type Session = {
  user: AuthUser | null;
  token: string;
  ready: boolean;
  claims: any[];
  loadClaims: (token?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateProfile: (data: { name?: string; avatar?: File | null; removeAvatar?: boolean }) => Promise<void>;
  disconnectGoogle: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState('');
  const [ready, setReady] = useState(false);
  const [claims, setClaims] = useState<any[]>([]);

  const loadClaims = useCallback(async (authToken?: string) => {
    const t = authToken ?? token;
    if (!t) return;
    try {
      const data = await listClaims(t);
      setClaims(Array.isArray(data) ? data : []);
    } catch {
      setClaims([]);
    }
  }, [token]);

  useEffect(() => {
    const savedToken = localStorage.getItem('reimbursement_token');
    const savedUser = localStorage.getItem('reimbursement_user');
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as AuthUser;
        setToken(savedToken);
        setUser(parsed);
        listClaims(savedToken).then((d) => setClaims(Array.isArray(d) ? d : [])).catch(() => {});
      } catch {
        localStorage.removeItem('reimbursement_token');
        localStorage.removeItem('reimbursement_user');
      }
    }
    setReady(true);
  }, []);

  // SSO Google: terima hasil login dari popup callback
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.origin || !event.origin.includes('trycloudflare.com')) return;
      const data = event.data as any;
      if (!data?.token || !data?.user) return;
      localStorage.setItem('reimbursement_token', data.token);
      localStorage.setItem('reimbursement_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      listClaims(data.token).then((d) => setClaims(Array.isArray(d) ? d : [])).catch(() => {});
      window.removeEventListener('message', onMessage);
      router.push('/dashboard');
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [router]);

  const persist = (nextUser: AuthUser, nextToken: string) => {
    localStorage.setItem('reimbursement_token', nextToken);
    localStorage.setItem('reimbursement_user', JSON.stringify(nextUser));
    setUser(nextUser);
    setToken(nextToken);
  };

  const login = async (email: string, password: string) => {
    const payload = await loginUser({ email, password });
    const nextUser = payload.user as AuthUser;
    const nextToken = payload.token as string;
    persist(nextUser, nextToken);
    const data = await listClaims(nextToken).catch(() => []);
    setClaims(Array.isArray(data) ? data : []);
    router.push('/dashboard');
  };

  const register = async (name: string, email: string, password: string) => {
    const payload = await registerUser({ name, email, password });
    const nextUser = payload.user as AuthUser;
    const nextToken = payload.token as string;
    persist(nextUser, nextToken);
    router.push('/dashboard');
  };

  const logout = () => {
    localStorage.removeItem('reimbursement_token');
    localStorage.removeItem('reimbursement_user');
    setUser(null);
    setToken('');
    setClaims([]);
    router.push('/login');
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await updateProfilePassword(token, { currentPassword, newPassword });
    persist(response.user as AuthUser, response.token);
  };

  const updateProfile = async (data: { name?: string; avatar?: File | null; removeAvatar?: boolean }) => {
    const response = await updateProfileName(token, data);
    persist(response.user as AuthUser, response.token);
  };

  const doDisconnectGoogle = async () => {
    await apiDisconnectGoogle(token);
    const nextUser = user ? { ...user, googleId: null } : user;
    if (nextUser) persist(nextUser as AuthUser, token);
  };

  // Redirect guards
  useEffect(() => {
    if (!ready) return;
    const publicPages = ['/login', '/register'];
    const isPublic = publicPages.includes(pathname);
    if (!user && !isPublic) router.replace('/login');
    if (user && isPublic) router.replace('/dashboard');
  }, [ready, user, pathname, router]);

  const value = useMemo<Session>(() => ({
    user,
    token,
    ready,
    claims,
    loadClaims,
    login,
    register,
    logout,
    changePassword,
    updateProfile,
    disconnectGoogle: doDisconnectGoogle,
  }), [user, token, ready, claims, loadClaims, logout]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function RequireSession({ children }: { children: React.ReactNode }) {
  const { ready, user } = useSession();
  if (!ready || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f5f2] px-5">
        <div className="rounded-xl border border-stone-200 bg-white px-6 py-5 text-sm font-medium text-stone-600">
          Memuat sesi Anda...
        </div>
      </main>
    );
  }
  return <>{children}</>;
}
