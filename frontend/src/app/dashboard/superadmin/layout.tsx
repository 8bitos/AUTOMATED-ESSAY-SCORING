"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const SuperadminLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    } else if (!authLoading && user?.peran !== "superadmin") {
      if (user?.peran === "teacher") router.push("/dashboard/teacher");
      else if (user?.peran === "student") router.push("/dashboard/student");
      else router.push("/login");
    }
  }, [authLoading, isAuthenticated, user, router]);

  if (authLoading || !user || user.peran !== "superadmin") {
    return <div className="flex justify-center items-center min-h-screen text-sm text-slate-500">Loading superadmin...</div>;
  }

  return (
    <div className="flex h-screen bg-slate-50 antialiased">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} user={user} />
      <div className="relative flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
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

export default SuperadminLayout;
