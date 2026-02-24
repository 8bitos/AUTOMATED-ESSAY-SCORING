"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';

const TeacherDashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    return <div className="flex justify-center items-center min-h-screen text-xl">Loading teacher dashboard...</div>;
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
