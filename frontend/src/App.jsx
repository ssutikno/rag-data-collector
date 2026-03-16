import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import DocumentList from './pages/documents/DocumentList';
import DocumentUpload from './pages/documents/DocumentUpload';
import DocumentDetail from './pages/documents/DocumentDetail';
import Profile from './pages/Profile';
import Users from './pages/admin/Users';
import AuditLogs from './pages/admin/AuditLogs';
import Companies from './pages/admin/Companies';
import Departments from './pages/admin/Departments';
import SubDepartments from './pages/admin/SubDepartments';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected */}
          <Route element={<PrivateRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/documents" element={<DocumentList />} />
              <Route path="/documents/upload" element={<DocumentUpload />} />
              <Route path="/documents/:id" element={<DocumentDetail />} />

              {/* Admin only */}
              <Route element={<AdminRoute />}>
                <Route path="/admin/users" element={<Users />} />
                <Route path="/admin/audit-logs" element={<AuditLogs />} />
                <Route path="/admin/companies" element={<Companies />} />
                <Route path="/admin/departments" element={<Departments />} />
                <Route path="/admin/subdepartments" element={<SubDepartments />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
