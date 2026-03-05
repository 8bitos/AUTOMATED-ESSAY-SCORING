"use client";

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

const TeacherDashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isPopupOnlyMateri =
    (pathname || "").includes("/dashboard/teacher/materi/") &&
    (searchParams.get("popupOnly") === "1" || searchParams.get("openEditMaterial") === "1");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && user?.peran !== 'teacher') {
      // Restrict this layout strictly for teacher role only.
      if (user?.peran === 'student') {
        router.push('/dashboard/student');
      } else if (user?.peran === 'superadmin') {
        router.push('/dashboard/superadmin');
      } else {
        router.push('/login');
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  if (authLoading || !user || user.peran !== 'teacher') {
    // Show a loading indicator or redirect if not authorized as a teacher.
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
          <span className="inline-block h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
          Memuat dashboard guru...
        </div>
      </div>
    );
  }

  if (isPopupOnlyMateri) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen h-[100dvh] bg-[color:var(--sand-100)] antialiased">
      {/* Sidebar */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} user={user} />

      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-x-hidden min-h-0">
        {/* Topbar */}
        <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-10 pb-16 w-full max-w-7xl mx-auto">
            {user?.is_teacher_verified === false && (
              <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Akun guru Anda <strong>belum terverifikasi</strong>. Anda tetap bisa melihat data, tetapi fitur create/update/delete dinonaktifkan sampai di-ACC oleh admin.
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default TeacherDashboardLayout;
