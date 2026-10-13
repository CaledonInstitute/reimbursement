'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/app/session';

export default function HomePage() {
  const { ready, user } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(user ? '/dashboard' : '/login');
  }, [ready, user, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-sm font-medium text-muted-foreground">Mengalihkan...</p>
    </main>
  );
}
