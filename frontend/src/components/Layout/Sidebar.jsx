import { NavLink } from 'react-router-dom';
import { useAuth, isAdmin, isContributor } from '../../contexts/AuthContext';

export default function Sidebar() {
  const { user } = useAuth();

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <i className="bi bi-database-fill brand-icon" />
        <span>RAG Data Collector</span>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="nav-section-title">Main</div>
        <NavLink to="/" end className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
          <i className="bi bi-speedometer2" /> Dashboard
        </NavLink>
        <NavLink to="/documents" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
          <i className="bi bi-file-earmark-text" /> Documents
        </NavLink>
        {isContributor(user) && (
          <NavLink to="/documents/upload" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
            <i className="bi bi-cloud-upload" /> Upload File
          </NavLink>
        )}

        {isAdmin(user) && (
          <>
            <div className="nav-section-title" style={{ marginTop: '0.5rem' }}>Administration</div>
            <NavLink to="/admin/users" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <i className="bi bi-people" /> Users
            </NavLink>
            <NavLink to="/admin/companies" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <i className="bi bi-buildings" /> Companies
            </NavLink>
            <NavLink to="/admin/departments" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <i className="bi bi-diagram-3" /> Departments
            </NavLink>
            <NavLink to="/admin/subdepartments" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <i className="bi bi-diagram-2" /> Sub-Departments
            </NavLink>
            <NavLink to="/admin/audit-logs" className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}>
              <i className="bi bi-shield-check" /> Audit Logs
            </NavLink>
          </>
        )}
      </nav>

      {/* User info at bottom */}
      <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="d-flex align-items-center gap-2">
          <div
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--sidebar-active)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
            }}
          >
            {user?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div style={{ color: '#fff', fontSize: '0.82rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.full_name}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', textTransform: 'capitalize' }}>
              {user?.role?.replace('_', ' ')}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
