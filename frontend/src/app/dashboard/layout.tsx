"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
          <span className="inline-block h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
          Memuat dashboard...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Redirect in progress
  }

  return <>{children}</>;
};

export default DashboardLayout;