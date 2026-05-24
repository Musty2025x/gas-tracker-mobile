import React, { createContext, useContext, useEffect, useState } from 'react';
import { setAuthToken, User } from './api';

const AUTH_KEY = 'gastracker_auth';

interface AuthState {
  user: User | null;
  token: string | null;
  stationId: string | null;
}

interface AuthContextType extends AuthState {
  login: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
  setStation: (id: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, token: null, stationId: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage (web) or AsyncStorage (native)
    try {
      const saved = localStorage.getItem(AUTH_KEY);
      if (saved) {
        const parsed: AuthState = JSON.parse(saved);
        setState(parsed);
        setAuthToken(parsed.token);
      }
    } catch {}
    setIsLoading(false);
  }, []);

  const login = async (token: string, user: User) => {
    const newState: AuthState = {
      token,
      user,
      stationId: user.stationId || null,
    };
    setState(newState);
    setAuthToken(token);
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(newState)); } catch {}
  };

  const logout = async () => {
    setState({ user: null, token: null, stationId: null });
    setAuthToken(null);
    try { localStorage.removeItem(AUTH_KEY); } catch {}
  };

  const setStation = (id: string) => {
    setState(prev => {
      const next = { ...prev, stationId: id };
      try { localStorage.setItem(AUTH_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, setStation, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
