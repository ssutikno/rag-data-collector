import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import DataTable from 'datatables.net-react';
import DT from 'datatables.net-bs5';
import 'datatables.net-bs5/css/dataTables.bootstrap5.min.css';
import {
  Card, Badge, Button, Col, Form, Modal, Row, Spinner, Alert,
} from 'react-bootstrap';
import api from '../../api/client';

DataTable.use(DT);

const ROLES    = ['system_admin', 'dept_admin', 'contributor', 'viewer'];
const STATUSES = ['active', 'suspended'];

const ROLE_BADGE = {
  system_admin: 'purple',
  dept_admin:   'primary',
  contributor:  'info',
  viewer:       'secondary',
};

// HTML-escape helper to prevent XSS in DataTables render functions
const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export default function Users() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  // Edit modal
  const [editUser, setEditUser] = useState(null);
  const [saving,   setSaving]   = useState(false);
  const [editForm, setEditForm] = useState({});

  // Org dropdowns (edit modal)
  const [companies,   setCompanies]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepts,    setSubDepts]    = useState([]);

  // Import modal
  const [showImport,   setShowImport]   = useState(false);
  const [importFile,   setImportFile]   = useState(null);
  const [importing,    setImporting]    = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/admin/users?limit=9999&page=1');
      setUsers(res.data.data?.data ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // Org dropdowns depend on edit form selections
  useEffect(() => {
    api.get('/api/companies').then((r) => setCompanies(r.data.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!editForm.company_id) { setDepartments([]); return; }
    api.get(`/api/departments?company_id=${editForm.company_id}`)
      .then((r) => setDepartments(r.data.data ?? []))
      .catch(() => {});
  }, [editForm.company_id]);

  useEffect(() => {
    if (!editForm.department_id) { setSubDepts([]); return; }
    api.get(`/api/sub-departments?department_id=${editForm.department_id}`)
      .then((r) => setSubDepts(r.data.data ?? []))
      .catch(() => {});
  }, [editForm.department_id]);

  // ---------------------------------------------------------------------------
  // Edit modal handlers
  // ---------------------------------------------------------------------------
  const openEdit = useCallback((u) => {
    setEditUser(u);
    setEditForm({
      full_name:     u.full_name,
      job_title:     u.job_title || '',
      phone:         u.phone     || '',
      role:          u.role,
      status:        u.status,
      company_id:    u.company_id    ?? '',
      department_id: u.department_id ?? '',
      sub_dept_id:   u.sub_dept_id   ?? '',
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const uid = editUser.user_id;
      await api.put(`/api/admin/users/${uid}`, {
        full_name:     editForm.full_name,
        job_title:     editForm.job_title || null,
        phone:         editForm.phone     || null,
        company_id:    editForm.company_id    || null,
        department_id: editForm.department_id || null,
        sub_dept_id:   editForm.sub_dept_id   || null,
      });
      if (editForm.role !== editUser.role) {
        await api.put(`/api/admin/users/${uid}/role`, { role: editForm.role });
      }
      if (editForm.status !== editUser.status) {
        await api.put(`/api/admin/users/${uid}/status`, { status: editForm.status });
      }
      setSuccess(`User "${editUser.full_name}" updated.`);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Import handlers
  // ---------------------------------------------------------------------------
  const downloadTemplate = () => {
    const header  = 'full_name,email,password,role,job_title,phone,company,department,sub_department';
    const example = 'Jane Smith,jane@company.com,TempPass123!,contributor,Data Analyst,+15550001,Acme Corp,Engineering,Backend';
    const csv  = [header, example].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'user_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const openImport = () => {
    setImportFile(null);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowImport(true);
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await api.post('/api/admin/users/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const d = res.data.data;
      setImportResult(d);
      if (d.created > 0) {
        setSuccess(`${d.created} user(s) imported successfully.`);
        fetchUsers();
      }
    } catch (err) {
      setImportResult({ error: err.response?.data?.error || 'Import failed.' });
    } finally {
      setImporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // DataTables column definitions (stable - openEdit uses only state setters)
  // ---------------------------------------------------------------------------
  const columns = useMemo(() => [
    {
      data: 'full_name',
      title: 'Name',
      render: (data, type, row) =>
        type === 'display'
          ? `<div class="fw-semibold">${esc(data)}</div>${row.job_title ? `<div class="text-muted small">${esc(row.job_title)}</div>` : ''}`
          : data,
    },
    {
      data: 'email',
      title: 'Email',
      className: 'small',
    },
    {
      data: 'company_name',
      title: 'Company',
      className: 'small',
      render: (data, type) =>
        type === 'display' ? (esc(data) || '<span class="text-muted">&mdash;</span>') : (data ?? ''),
    },
    {
      data: 'department_name',
      title: 'Department',
      className: 'small',
      render: (data, type) =>
        type === 'display' ? (esc(data) || '<span class="text-muted">&mdash;</span>') : (data ?? ''),
    },
    {
      data: 'role',
      title: 'Role',
      render: (data, type) => {
        if (type !== 'display') return data ?? '';
        const bg  = ROLE_BADGE[data] ?? 'secondary';
        const cls = bg === 'purple' ? 'badge-role-system_admin text-white' : `bg-${bg}`;
        return `<span class="badge ${cls}">${esc(data?.replace('_', ' '))}</span>`;
      },
    },
    {
      data: 'status',
      title: 'Status',
      render: (data, type) =>
        type === 'display'
          ? `<span class="badge bg-${data === 'active' ? 'success' : 'danger'}">${esc(data)}</span>`
          : (data ?? ''),
    },
    {
      data: 'last_login_at',
      title: 'Last Login',
      className: 'small text-muted',
      render: (data, type) => {
        if (type !== 'display') return data ?? '';
        return data ? new Date(data).toLocaleDateString() : 'Never';
      },
    },
    {
      data: null,
      title: '',
      orderable: false,
      searchable: false,
      defaultContent: '',
      createdCell: (td, _cell, row) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-sm btn-outline-primary';
        btn.textContent = 'Edit';
        btn.onclick = () => openEdit(row);
        td.appendChild(btn);
      },
    },
  ], [openEdit]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div>
      <h5 className="fw-bold mb-3">User Management</h5>

      {error   && <Alert variant="danger"  dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
          <span className="fw-semibold">
            Users <Badge bg="secondary">{users.length}</Badge>
          </span>
          <Button variant="outline-success" size="sm" onClick={openImport}>
            <i className="bi bi-upload me-1" />Import Users
          </Button>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : (
            <DataTable
              data={users}
              columns={columns}
              className="table table-hover w-100"
              options={{
                pageLength: 25,
                lengthMenu: [[10, 25, 50, 100, -1], ['10', '25', '50', '100', 'All']],
                order: [[0, 'asc']],
                language: { emptyTable: 'No users found' },
              }}
            >
              <thead className="table-light">
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Department</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th />
                </tr>
              </thead>
            </DataTable>
          )}
        </Card.Body>
      </Card>

      {/* â”€â”€ Edit User Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Modal show={!!editUser} onHide={() => setEditUser(null)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit User - {editUser?.full_name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger" className="py-2">{error}</Alert>}
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Full Name</Form.Label>
              <Form.Control value={editForm.full_name ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, full_name: e.target.value }))} />
            </Col>
            <Col md={6}>
              <Form.Label>Job Title</Form.Label>
              <Form.Control value={editForm.job_title ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, job_title: e.target.value }))} />
            </Col>
            <Col md={6}>
              <Form.Label>Role</Form.Label>
              <Form.Select value={editForm.role ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLES.map((r) => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </Form.Select>
            </Col>
            <Col md={6}>
              <Form.Label>Status</Form.Label>
              <Form.Select value={editForm.status ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Company</Form.Label>
              <Form.Select value={editForm.company_id ?? ''}
                onChange={(e) => setEditForm((f) => ({
                  ...f,
                  company_id:    e.target.value ? parseInt(e.target.value, 10) : '',
                  department_id: '',
                  sub_dept_id:   '',
                }))}>
                <option value="">None</option>
                {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Department</Form.Label>
              <Form.Select value={editForm.department_id ?? ''}
                onChange={(e) => setEditForm((f) => ({
                  ...f,
                  department_id: e.target.value ? parseInt(e.target.value, 10) : '',
                  sub_dept_id:   '',
                }))}
                disabled={!editForm.company_id}>
                <option value="">None</option>
                {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Sub-Department</Form.Label>
              <Form.Select value={editForm.sub_dept_id ?? ''}
                onChange={(e) => setEditForm((f) => ({
                  ...f,
                  sub_dept_id: e.target.value ? parseInt(e.target.value, 10) : '',
                }))}
                disabled={!editForm.department_id}>
                <option value="">None</option>
                {subDepts.map((s) => <option key={s.sub_dept_id} value={s.sub_dept_id}>{s.name}</option>)}
              </Form.Select>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setEditUser(null)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? <><Spinner size="sm" className="me-2" />Saving...</> : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* â”€â”€ Import Users Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Modal show={showImport} onHide={() => setShowImport(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title><i className="bi bi-upload me-2" />Import Users</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            Upload a CSV file to create multiple users at once. Download the template to see the required format.
            Required columns: <code>full_name</code>, <code>email</code>, <code>password</code>, <code>role</code>.
            Optional columns: <code>job_title</code>, <code>phone</code>, <code>company</code>, <code>department</code>, <code>sub_department</code>.
            Company / department / sub-department are matched by <strong>name</strong> and created automatically if they do not exist.
            Valid roles: <code>system_admin</code>, <code>dept_admin</code>, <code>contributor</code>, <code>viewer</code>.
          </p>
          <div className="mb-3">
            <Button variant="outline-secondary" size="sm" onClick={downloadTemplate}>
              <i className="bi bi-download me-1" />Download CSV Template
            </Button>
          </div>
          <Form.Group>
            <Form.Label className="fw-semibold">Select CSV File <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="file"
              accept=".csv,text/csv"
              ref={fileInputRef}
              onChange={(e) => { setImportFile(e.target.files[0] || null); setImportResult(null); }}
            />
          </Form.Group>

          {importResult && (
            <div className="mt-3">
              {importResult.error ? (
                <Alert variant="danger">{importResult.error}</Alert>
              ) : (
                <>
                  <Alert variant={importResult.created > 0 ? 'success' : 'warning'} className="py-2">
                    <strong>{importResult.created}</strong> user(s) created
                    {importResult.skipped?.length > 0 && <>, <strong>{importResult.skipped.length}</strong> skipped (duplicate email)</>}
                    {importResult.errored?.length > 0 && <>, <strong className="text-danger">{importResult.errored.length}</strong> failed</>}
                  </Alert>
                  {importResult.skipped?.length > 0 && (
                    <div className="mb-2">
                      <strong className="small">Skipped (already exists):</strong>
                      <ul className="small mb-0 mt-1">
                        {importResult.skipped.map((r) => (
                          <li key={r.row}>Row {r.row}: {r.email} - {r.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {importResult.errored?.length > 0 && (
                    <div>
                      <strong className="small text-danger">Errors:</strong>
                      <ul className="small mb-0 mt-1">
                        {importResult.errored.map((r) => (
                          <li key={r.row} className="text-danger">Row {r.row}{r.email ? ` (${r.email})` : ''}: {r.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowImport(false)}>Close</Button>
          <Button variant="success" onClick={handleImport} disabled={!importFile || importing}>
            {importing ? <><Spinner size="sm" className="me-2" />Importing...</> : 'Import'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
