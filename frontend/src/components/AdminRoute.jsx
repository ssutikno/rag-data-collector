import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, isAdmin } from '../contexts/AuthContext';

export default function AdminRoute() {
  const { user } = useAuth();
  return isAdmin(user) ? <Outlet /> : <Navigate to="/" replace />;
}
