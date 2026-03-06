"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export interface User {
  id: string;
  nama_lengkap: string;
  peran: 'student' | 'teacher' | 'superadmin'; // Changed 'role' to 'peran'
  is_teacher_verified?: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (user: User) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean; // Added loading state
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPopupOnlyMateri, setIsPopupOnlyMateri] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    const popupOnly =
      (pathname || "").includes("/dashboard/teacher/materi/") &&
      (qs.get("popupOnly") === "1" || qs.get("openEditMaterial") === "1");
    setIsPopupOnlyMateri(popupOnly);
  }, [pathname]);

  const checkUserLoggedIn = async () => {
    setLoading(true);
    try {
      // This endpoint should be protected and return user info if the HttpOnly cookie is valid
      const response = await fetch(`/api/me`, { credentials: 'include' });

      if (response.ok) {
        const userData: User = await response.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUserLoggedIn();
  }, []);

  const login = async (newUser: User) => {
    // The /login endpoint response will give us the user data directly.
    // The HttpOnly cookie is set by the server. We just set the user in the context.
    setLoading(true);
    setUser(newUser);
    setLoading(false);
  };

  const logout = async () => {
    try {
      // Call the backend to clear the HttpOnly cookie
      await fetch(`/api/logout`, { method: 'POST', credentials: 'include' });
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  const isAuthenticated = !!user;

  // Render a loading state while we check for an active session
  if (loading) {
    if (isPopupOnlyMateri) return null;
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-700 shadow-sm">
          <span className="inline-block h-5 w-5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin" />
          Memuat sesi...
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
