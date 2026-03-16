import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/api/profile');
      setUser(res.data.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const login = async (email, password) => {
    await api.post('/api/auth/login', { email, password });
    await fetchProfile();
  };

  const logout = async () => {
    try { await api.post('/api/auth/logout'); } catch { /* ignore */ }
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, fetchProfile }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

// Role helpers
export const isAdmin      = (user) => user?.role === 'system_admin';
export const isDeptAdmin  = (user) => ['system_admin', 'dept_admin'].includes(user?.role);
export const isContributor = (user) => ['system_admin', 'dept_admin', 'contributor'].includes(user?.role);
