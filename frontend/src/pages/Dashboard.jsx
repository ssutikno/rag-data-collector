import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Row, Col, Card, Spinner, Badge } from 'react-bootstrap';
import api from '../api/client';
import { useAuth, isContributor } from '../contexts/AuthContext';

function StatCard({ icon, label, value, bgClass, iconColor }) {
  return (
    <Card className="stat-card h-100">
      <Card.Body className="d-flex align-items-center gap-3">
        <div className={`stat-icon ${bgClass}`}>
          <i className={`bi ${icon}`} style={{ color: iconColor }} />
        </div>
        <div>
          <div className="h4 mb-0 fw-bold">{value ?? <Spinner size="sm" />}</div>
          <div className="text-muted small">{label}</div>
        </div>
      </Card.Body>
    </Card>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats]     = useState(null);
  const [recent, setRecent]   = useState([]);
  const [loading, setLoading] = useState(true);

  // Resolved org names
  const [orgNames, setOrgNames] = useState({ company: null, dept: null, subDept: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [allDocs, myDocs] = await Promise.all([
          api.get('/api/documents?limit=1'),
          api.get('/api/documents?limit=5&page=1'),
        ]);
        if (!cancelled) {
          setStats({
            total: allDocs.data.data?.total ?? 0,
          });
          setRecent(myDocs.data.data?.data ?? []);
        }
      } catch {
        if (!cancelled) setStats({ total: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Resolve company / department / sub-department names from IDs
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const names = { company: null, dept: null, subDept: null };
        if (user.company_id) {
          const r = await api.get('/api/public/companies');
          const found = (r.data.data ?? []).find((c) => c.company_id == user.company_id);
          names.company = found?.name ?? null;
        }
        if (user.department_id && user.company_id) {
          const r = await api.get(`/api/public/departments?company_id=${user.company_id}`);
          const found = (r.data.data ?? []).find((d) => d.department_id == user.department_id);
          names.dept = found?.name ?? null;
        }
        if (user.sub_dept_id && user.department_id) {
          const r = await api.get(`/api/public/sub-departments?department_id=${user.department_id}`);
          const found = (r.data.data ?? []).find((s) => s.sub_dept_id == user.sub_dept_id);
          names.subDept = found?.name ?? null;
        }
        if (!cancelled) setOrgNames(names);
      } catch { /* silently ignore — non-critical */ }
    })();
    return () => { cancelled = true; };
  }, [user?.company_id, user?.department_id, user?.sub_dept_id]);

  const roleBadgeVariant = {
    system_admin:  'purple',
    dept_admin:    'primary',
    contributor:   'info',
    viewer:        'secondary',
  };

  return (
    <div>
      {/* Welcome banner */}
      <div className="card border-0 mb-4" style={{ background: 'linear-gradient(135deg,#1e2a3a,#2d4a6e)', borderRadius: '0.75rem' }}>
        <div className="card-body p-4 text-white">
          <h5 className="fw-bold mb-1">
            Welcome back, {user?.full_name?.split(' ')[0]} 👋
          </h5>
          <p className="mb-0 opacity-75 small">
            {user?.job_title && <>{user.job_title} · </>}
            Role:{' '}
            <span className="fw-semibold text-capitalize">
              {user?.role?.replace('_', ' ')}
            </span>
          </p>
        </div>
      </div>

      {/* Stats */}
      <Row className="g-3 mb-4">
        <Col xs={6} md={3}>
          <StatCard
            icon="bi-file-earmark-text"
            label="Total Documents"
            value={loading ? null : stats?.total}
            bgClass="bg-primary bg-opacity-10"
            iconColor="#3b82f6"
          />
        </Col>
        <Col xs={6} md={3}>
          <StatCard
            icon="bi-person-badge"
            label="Your Role"
            value={
              <span className="fs-6 text-capitalize">
                {user?.role?.replace('_', ' ')}
              </span>
            }
            bgClass="bg-success bg-opacity-10"
            iconColor="#10b981"
          />
        </Col>
        <Col xs={6} md={3}>
          <StatCard
            icon="bi-buildings"
            label="Organisation"
            value={
              <span className="fs-6">
                {orgNames.company ?? (user?.company_id ? 'Assigned' : 'Unassigned')}
              </span>
            }
            bgClass="bg-warning bg-opacity-10"
            iconColor="#f59e0b"
          />
        </Col>
        <Col xs={6} md={3}>
          <StatCard
            icon="bi-cloud-check"
            label="System Status"
            value={<span className="fs-6 text-success">Online</span>}
            bgClass="bg-info bg-opacity-10"
            iconColor="#06b6d4"
          />
        </Col>
      </Row>

      {/* Quick actions */}
      <Row className="g-3 mb-4">
        <Col xs={12} md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h6 className="fw-bold mb-3"><i className="bi bi-lightning-charge me-2 text-warning" />Quick Actions</h6>
              <div className="d-flex flex-wrap gap-2">
                <Link to="/documents" className="btn btn-sm btn-outline-primary">
                  <i className="bi bi-search me-1" />Browse Documents
                </Link>
                {isContributor(user) && (
                  <Link to="/documents/upload" className="btn btn-sm btn-primary">
                    <i className="bi bi-cloud-upload me-1" />Upload File
                  </Link>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body>
              <h6 className="fw-bold mb-3"><i className="bi bi-person-circle me-2 text-info" />My Profile</h6>
              <div className="small text-muted">
                <div><i className="bi bi-envelope me-2" />{user?.email}</div>
                {user?.phone && <div className="mt-1"><i className="bi bi-telephone me-2" />{user.phone}</div>}
                {orgNames.company ? (
                  <div className="mt-1"><i className="bi bi-building me-2" />{orgNames.company}</div>
                ) : user?.company_id ? (
                  <div className="mt-1"><i className="bi bi-building me-2" />Company ID: {user.company_id}</div>
                ) : null}
                {orgNames.dept && (
                  <div className="mt-1"><i className="bi bi-diagram-3 me-2" />{orgNames.dept}</div>
                )}
                {orgNames.subDept && (
                  <div className="mt-1"><i className="bi bi-diagram-2 me-2" />{orgNames.subDept}</div>
                )}
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent documents */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center py-3">
          <h6 className="mb-0 fw-bold">Recent Documents</h6>
          <Link to="/documents" className="btn btn-sm btn-outline-secondary">View all</Link>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-4"><Spinner /></div>
          ) : recent.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-inbox display-6 d-block mb-2" />
              No documents yet
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Title</th>
                    <th>File</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recent.map((doc) => (
                    <tr key={doc.document_id} className="doc-row">
                      <td className="fw-semibold">{doc.title || doc.file_name}</td>
                      <td className="text-muted small">
                        <div>{doc.file_name}</div>
                        {doc.file_size_bytes ? (
                          <div>
                            {doc.file_size_bytes >= 1048576
                              ? `${(doc.file_size_bytes / 1048576).toFixed(2)} MB`
                              : `${(doc.file_size_bytes / 1024).toFixed(1)} KB`}
                          </div>
                        ) : null}
                      </td>
                      <td><Badge bg="light" text="dark">{doc.document_type}</Badge></td>
                      <td>
                        <Badge bg={doc.status === 'stored' ? 'success' : doc.status === 'archived' ? 'secondary' : 'warning'}>
                          {doc.status}
                        </Badge>
                      </td>
                      <td className="text-muted small">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <Link to={`/documents/${doc.document_id}`} className="btn btn-sm btn-outline-primary">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
