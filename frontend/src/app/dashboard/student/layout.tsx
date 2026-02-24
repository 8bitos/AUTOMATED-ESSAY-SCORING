"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar'; // Assuming a generic or student-specific sidebar
import Topbar from '@/components/Topbar';   // Assuming a generic or student-specific topbar

const StudentDashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    } else if (!authLoading && user?.peran !== 'student') {
      // Redirect non-students away from the student dashboard layout
      if (user?.peran === 'teacher') {
        router.push('/dashboard/teacher');
      } else if (user?.peran === 'superadmin') {
        router.push('/dashboard/superadmin');
      } else {
        router.push('/login'); // Fallback for unexpected roles
      }
    }
  }, [authLoading, isAuthenticated, user, router]);

  if (authLoading || !user || user.peran !== 'student') {
    // Show a loading indicator or redirect if not authorized as a student
    return <div className="flex justify-center items-center min-h-screen text-xl">Loading student dashboard...</div>;
  }

  return (
    <div className="flex h-screen bg-[color:var(--sand-100)] antialiased">
      {/* Sidebar - Conditional rendering for student-specific or generic */}
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} user={user} />

      {/* Content area */}
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Topbar - Conditional rendering for student-specific or generic */}
        <Topbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="grow">
          <div className="px-4 sm:px-6 lg:px-8 py-10 w-full max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default StudentDashboardLayout;
