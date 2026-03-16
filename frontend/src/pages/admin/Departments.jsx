import { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Badge, Button, Form, Row, Col,
  Modal, Spinner, Alert,
} from 'react-bootstrap';
import api from '../../api/client';

const BLANK = { name: '', code: '', description: '', company_id: '' };

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [companies,   setCompanies]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState('');

  const [filterCompany, setFilterCompany] = useState('');

  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState(null);
  const [form,        setForm]        = useState(BLANK);
  const [saving,      setSaving]      = useState(false);
  const [modalError,  setModalError]  = useState('');

  const fetchDepts = useCallback(async () => {
    setLoading(true);
    try {
      const params = filterCompany ? `?company_id=${filterCompany}` : '';
      const res = await api.get(`/api/departments${params}`);
      setDepartments(res.data.data ?? []);
    } catch {
      setDepartments([]);
    } finally {
      setLoading(false);
    }
  }, [filterCompany]);

  useEffect(() => { fetchDepts(); }, [fetchDepts]);

  useEffect(() => {
    api.get('/api/companies').then((r) => setCompanies(r.data.data ?? [])).catch(() => {});
  }, []);

  const companyName = (id) => companies.find((c) => c.company_id === id)?.name ?? id;

  const openCreate = () => { setEditing(null); setForm(BLANK); setModalError(''); setShowModal(true); };
  const openEdit   = (d) => {
    setEditing(d);
    setForm({ name: d.name, code: d.code, description: d.description || '', company_id: d.company_id });
    setModalError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setModalError('');
    try {
      if (editing) {
        await api.put(`/api/departments/${editing.department_id}`, form);
        setSuccess(`Department "${form.name}" updated.`);
      } else {
        await api.post('/api/departments', form);
        setSuccess(`Department "${form.name}" created.`);
      }
      setShowModal(false);
      fetchDepts();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (d) => {
    if (!window.confirm(`Deactivate "${d.name}"?`)) return;
    try {
      await api.delete(`/api/departments/${d.department_id}`);
      setSuccess(`Department "${d.name}" deactivated.`);
      fetchDepts();
    } catch (err) {
      setError(err.response?.data?.error || 'Deactivate failed.');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">Departments</h5>
        <Button variant="primary" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" />Add Department
        </Button>
      </div>

      {error   && <Alert variant="danger"  dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Company filter */}
      <Card className="border-0 shadow-sm mb-3">
        <Card.Body className="py-2">
          <Row className="g-2 align-items-center">
            <Col xs="auto"><span className="text-muted small">Filter by company:</span></Col>
            <Col xs={12} md={4}>
              <Form.Select value={filterCompany} onChange={(e) => setFilterCompany(e.target.value)} size="sm">
                <option value="">All Companies</option>
                {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}
              </Form.Select>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : departments.length === 0 ? (
            <div className="text-center text-muted py-5">No departments found</div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Company</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.department_id}>
                      <td className="fw-semibold">{d.name}</td>
                      <td><code>{d.code}</code></td>
                      <td className="text-muted">{companyName(d.company_id)}</td>
                      <td>
                        <Badge bg={d.is_active ? 'success' : 'secondary'}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button size="sm" variant="outline-primary" onClick={() => openEdit(d)}>Edit</Button>
                          {d.is_active && (
                            <Button size="sm" variant="outline-danger" onClick={() => handleDeactivate(d)}>Deactivate</Button>
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
          <Modal.Title>{editing ? 'Edit Department' : 'New Department'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalError && <Alert variant="danger" className="py-2">{modalError}</Alert>}
          <Row className="g-3">
            <Col md={12}>
              <Form.Label>Company <span className="text-danger">*</span></Form.Label>
              <Form.Select value={form.company_id}
                onChange={(e) => setForm((f) => ({ ...f, company_id: e.target.value ? parseInt(e.target.value, 10) : '' }))}
                disabled={!!editing}>
                <option value="">Select company…</option>
                {companies.map((c) => <option key={c.company_id} value={c.company_id}>{c.name}</option>)}
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
            disabled={saving || !form.name || !form.code || !form.company_id}>
            {saving ? <><Spinner size="sm" className="me-2" />Saving…</> : (editing ? 'Save' : 'Create')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
