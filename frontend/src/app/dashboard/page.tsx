"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const DashboardPage = () => {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated || !user) {
      router.push("/login");
      return;
    }
    if (user.peran === "student") {
      router.push("/dashboard/student");
      return;
    }
    if (user.peran === "superadmin") {
      router.push("/dashboard/superadmin");
      return;
    }
    router.push("/dashboard/teacher");
  }, [loading, isAuthenticated, user, router]);

  return (
    <div className="sage-panel p-6">
      <p className="text-sm text-slate-500">Mengarahkan ke dashboard sesuai peran...</p>
    </div>
  );
};

export default DashboardPage;
