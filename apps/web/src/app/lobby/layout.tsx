'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/auth-store';
import { useSocketStore } from '@/stores/socket-store';
import { useRoomStore } from '@/stores/room-store';
import { Button } from '@/components/ui/button';

export default function LobbyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const logout = useAuthStore((s) => s.logout);
  const socketConnect = useSocketStore((s) => s.connect);
  const socketDisconnect = useSocketStore((s) => s.disconnect);
  const connected = useSocketStore((s) => s.connected);
  const subscribeToSocket = useRoomStore((s) => s.subscribeToSocket);

  // Redirect to login if unauthenticated
  useEffect(() => {
    if (!accessToken || !user) {
      router.replace('/login');
    }
  }, [accessToken, user, router]);

  // Connect socket when authenticated
  useEffect(() => {
    if (accessToken && user) {
      socketConnect();
    }
  }, [accessToken, user, socketConnect]);

  // Subscribe to real-time room updates
  useEffect(() => {
    if (!connected) return;
    const unsubscribe = subscribeToSocket();
    return unsubscribe;
  }, [connected, subscribeToSocket]);

  function handleLogout() {
    socketDisconnect();
    logout();
    router.push('/login');
  }

  // Don't render lobby content until authenticated
  if (!accessToken || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-charcoal-950">
      {/* Nav Bar */}
      <nav className="border-b border-charcoal-700/60 bg-charcoal-900/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/lobby" className="flex items-center gap-2">
            <h1 className="text-glow font-heading text-xl font-bold tracking-wide text-gold-400">
              VTT Forge
            </h1>
          </Link>

          {/* Right side: user info + logout */}
          <div className="flex items-center gap-4">
            {/* Connection indicator */}
            <span className="flex items-center gap-1.5 text-xs text-parchment-400">
              <span
                className={[
                  'inline-block h-2 w-2 rounded-full',
                  connected ? 'bg-emerald-500' : 'bg-crimson-500',
                ].join(' ')}
              />
              {connected ? 'Connected' : 'Disconnected'}
            </span>

            {/* User display name */}
            <span className="hidden text-sm font-medium text-parchment-200 sm:inline">
              {user.displayName}
            </span>

            {/* Logout */}
            <Button variant="ghost" onClick={handleLogout} className="text-xs">
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
