import { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Badge, Button, Form, Row, Col,
  Modal, Spinner, Alert,
} from 'react-bootstrap';
import api from '../../api/client';

const BLANK = { name: '', code: '', description: '', department_id: '' };

export default function SubDepartments() {
  const [subDepts,    setSubDepts]    = useState([]);
  const [companies,   setCompanies]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  const [filterCompany, setFilterCompany] = useState('');
  const [filterDept,    setFilterDept]    = useState('');

  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [form,        setForm]        = useState(BLANK);
  const [saving,      setSaving]      = useState(false);
  const [modalError,  setModalError]  = useState('');

  // Modal dept options (for form company_id)
  const [modalDepts, setModalDepts] = useState([]);
  const [modalCompanyId, setModalCompanyId] = useState('');

  const fetchSubDepts = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterDept ? `?department_id=${filterDept}` : '';
      const res = await api.get(`/api/sub-departments${params}`);
      setSubDepts(res.data.data ?? []);
    } catch {
      setSubDepts([]);
    } finally {
      setLoading(false);
    }
  }, [filterDept]);

  useEffect(() => { fetchSubDepts(); }, [fetchSubDepts]);

  useEffect(() => {
    api.get('/api/companies').then((r) => setCompanies(r.data.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!filterCompany) { setDepartments([]); setFilterDept(''); return; }
    api.get(`/api/departments?company_id=${filterCompany}`)
      .then((r) => setDepartments(r.data.data ?? []))
      .catch(() => {});
  }, [filterCompany]);

  // Modal: load departments when company changes
  useEffect(() => {
    if (!modalCompanyId) { setModalDepts([]); return; }
    api.get(`/api/departments?company_id=${modalCompanyId}`)
      .then((r) => setModalDepts(r.data.data ?? []))
      .catch(() => {});
  }, [modalCompanyId]);

  const deptName = (id) => {
    const all = [...departments, ...modalDepts];
    return all.find((d) => d.department_id === id)?.name ?? id;
  };

  const openCreate = () => {
    setEditing(null);
    setForm(BLANK);
    setModalCompanyId('');
    setModalDepts([]);
    setModalError('');
    setShowModal(true);
  };

  const openEdit = (s) => {
    setEditing(s);
    setForm({ name: s.name, code: s.code, description: s.description || '', department_id: s.department_id });
    setModalCompanyId('');
    setModalError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setModalError('');
    try {
      if (editing) {
        await api.put(`/api/sub-departments/${editing.sub_dept_id}`, form);
        setSuccess(`Sub-department "${form.name}" updated.`);
      } else {
        await api.post('/api/sub-departments', form);
        setSuccess(`Sub-department "${form.name}" created.`);
      }
      setShowModal(false);
      fetchSubDepts();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (s) => {
    if (!window.confirm(`Deactivate "${s.name}"?`)) return;
    try {
      await api.delete(`/api/sub-departments/${s.sub_dept_id}`);
      setSuccess(`Sub-department "${s.name}" deactivated.`);
      fetchSubDepts();
    } catch (err) {
      setError(err.response?.data?.error || 'Deactivate failed.');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">Sub-Departments</h5>
        <Button variant="primary" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" />Add Sub-Department
        </Button>
      </div>

      {error   && <Alert variant="danger"  dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-3">
        <Card.Body className="py-2">
          <Row className="g-2 align-items-center">
            <Col xs="auto"><span className="text-muted small">Filter:</span></Col>
            <Col xs={12} md={4}>
              <Form.Select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} size="sm">
                <option value="">All Companies</option>
                {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}
              </Form.Select>
            </Col>
            <Col xs={12} md={4}>
              <Form.Select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} size="sm" disabled={!filterCompany}>
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d.department_id} value={d.department_id}>{d.name}</option>)}
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : subDepts.length === 0 ? (
            <div className="text-center text-muted py-5">No sub-departments found</div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Department ID</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {subDepts.map((s) => (
                    <tr key={s.sub_dept_id}>
                      <td className="fw-semibold">{s.name}</td>
                      <td><code>{s.code}</code></td>
                      <td className="text-muted">{s.department_id}</td>
                      <td>
                        <Badge bg={s.is_active ? 'success' : 'secondary'}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button size="sm" variant="outline-primary" onClick={() => openEdit(s)}>Edit</Button>
                          {s.is_active && (
                            <Button size="sm" variant="outline-danger" onClick={() => handleDeactivate(s)}>Deactivate</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Modal */}
      <Modal show={showModal} onHide={() => { setShowModal(false); setModalError(''); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Edit Sub-Department' : 'New Sub-Department'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalError && <Alert variant="danger" className="py-2">{modalError}</Alert>}
          <Row className="g-3">
            {!editing && (
              <Col md={12}>
                <Form.Label>Company <span className="text-danger">*</span></Form.Label>
                <Form.Select value={modalCompanyId}
                  onChange={(e) => { setModalCompanyId(e.target.value); setForm((f) => ({ ...f, department_id: '' })); }}>
                  <option value="">Select company…</option>
                  {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}
                </Form.Select>
              </Col>
            )}
            <Col md={12}>
              <Form.Label>Department <span className="text-danger">*</span></Form.Label>
              <Form.Select value={form.department_id}
                onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value ? parseInt(e.target.value, 10) : '' }))}
                disabled={editing ? false : !modalCompanyId}>
                <option value="">Select department…</option>
                {(editing ? departments.concat(modalDepts) : modalDepts).map((d) => (
                  <option key={d.department_id} value={d.department_id}>{d.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col md={8}>
              <Form.Label>Name <span className="text-danger">*</span></Form.Label>
              <Form.Control value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Col>
            <Col md={4}>
              <Form.Label>Code <span className="text-danger">*</span></Form.Label>
              <Form.Control value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </Col>
            <Col md={12}>
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleSave}
            disabled={saving || !form.name || !form.code || !form.department_id}>
            {saving ? <><Spinner size="sm" className="me-2" />Saving…</> : (editing ? 'Save' : 'Create')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
