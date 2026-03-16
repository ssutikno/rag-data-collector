import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Dropdown } from 'react-bootstrap';

const PAGE_TITLES = {
  '/':                    'Dashboard',
  '/profile':             'My Profile',
  '/documents':           'Documents',
  '/documents/upload':    'Upload Document',
  '/admin/users':         'User Management',
  '/admin/companies':     'Companies',
  '/admin/departments':   'Departments',
  '/admin/subdepartments':'Sub-Departments',
  '/admin/audit-logs':    'Audit Logs',
};

export default function Topbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const title =
    location.pathname.startsWith('/documents/') && location.pathname !== '/documents/upload'
      ? 'Document Detail'
      : PAGE_TITLES[location.pathname] ?? 'RAG Data Collector';

  return (
    <header className="topbar">
      <span className="topbar-title">{title}</span>

      <Dropdown align="end">
        <Dropdown.Toggle
          as="button"
          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"
        >
          <i className="bi bi-person-circle" />
          <span className="d-none d-sm-inline">{user?.full_name}</span>
        </Dropdown.Toggle>
        <Dropdown.Menu>
          <Dropdown.Header>
            {user?.email}
            <span className={`ms-2 badge badge-role-${user?.role} text-white`} style={{ fontSize: '0.68rem' }}>
              {user?.role?.replace('_', ' ')}
            </span>
          </Dropdown.Header>
          <Dropdown.Divider />
          <Dropdown.Item as={Link} to="/profile">
            <i className="bi bi-person-gear me-2" />Edit Profile
          </Dropdown.Item>
          <Dropdown.Item as={Link} to="/documents">
            <i className="bi bi-file-earmark me-2" />My Documents
          </Dropdown.Item>
          <Dropdown.Divider />
          <Dropdown.Item onClick={logout} className="text-danger">
            <i className="bi bi-box-arrow-right me-2" />Logout
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown>
    </header>
  );
}
