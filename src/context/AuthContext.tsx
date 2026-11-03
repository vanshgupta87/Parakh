import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, clearStoredToken, type ApiUser } from '@/lib/api';

interface AuthContextType {
  user: ApiUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (payload: { email: string; password: string; remember_me?: boolean }) => Promise<ApiUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await authApi.getMe();
      if (res?.user) {
        setUser(res.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (payload: { email: string; password: string; remember_me?: boolean }) => {
    setIsLoading(true);
    try {
      // authApi.login stores session_token in localStorage automatically
      await authApi.login(payload);
      // Fetch full user profile (with doctor_profile / patient_profile) from /me
      await refreshUser();
      // user state is now populated; return it
      // We re-read it from state indirectly via refreshUser; but state update is async,
      // so we call getMe directly here to get the full user for the caller
      const meRes = await authApi.getMe();
      const fullUser = meRes?.user;
      if (!fullUser) throw new Error("Failed to retrieve user profile after login.");
      setUser(fullUser);
      return fullUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    clearStoredToken();
    try {
      await authApi.logout();
    } catch (e) {
      console.warn("Logout error:", e);
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
