'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiUrl, setSessionExpiredHandler } from '@/lib/api';

interface User {
  email: string;
  name: string;
  id: string;
  role?: string;
  persona?: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<Pick<User, 'name' | 'persona'>>) => void;
  isAuthenticated: boolean;
  sessionExpired: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setSessionExpired(true);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(handleSessionExpired);
  }, [handleSessionExpired]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/auth/me`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setUser({ email: data.email, name: data.name, id: data.id, role: data.role, persona: data.persona });
        }
      } catch {
        // Network error — stay logged out
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setSessionExpired(false);
    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Login failed' }));
        throw new Error(err.detail || 'Login failed');
      }

      const userResponse = await fetch(`${apiUrl}/api/auth/me`, {
        credentials: 'include',
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser({ email: userData.email, name: userData.name, id: userData.id, role: userData.role, persona: userData.persona });
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch(`${apiUrl}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    } catch {
      // ignore
    }
    setUser(null);
    setSessionExpired(false);
  };

  const updateUser = useCallback((updates: Partial<Pick<User, 'name' | 'persona'>>) => {
    setUser((prev) => prev ? { ...prev, ...updates } : prev);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        isAuthenticated: !!user,
        sessionExpired,
      }}
    >
      {sessionExpired && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-yellow-500/90 text-slate-900 font-semibold px-6 py-3 rounded-lg shadow-lg">
          Your session has expired. Please{' '}
          <a href="/login" className="underline">sign in again</a>.
        </div>
      )}
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
