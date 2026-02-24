"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Redirect if not authenticated and not currently loading auth state
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || (!isAuthenticated && !authLoading)) {
    // Show a loading indicator or nothing while authentication state is being determined
    return <div>Loading dashboard...</div>;
  }
  
  // If authenticated, render the children (which will be the specific dashboard page or its layout)
  if (isAuthenticated) {
    return <>{children}</>;
  }

  return null; // Should not reach here if redirects work correctly
};

export default DashboardLayout;