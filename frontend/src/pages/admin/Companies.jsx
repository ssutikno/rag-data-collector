import { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Badge, Button, Form, Row, Col,
  Modal, Spinner, Alert,
} from 'react-bootstrap';
import api from '../../api/client';

const BLANK = { name: '', code: '', industry: '', description: '' };

export default function Companies() {
  const [companies, setCompanies] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');

  const [showModal,   setShowModal]   = useState(false);
  const [editing,     setEditing]     = useState(null);     // null = create, obj = edit
  const [form,        setForm]        = useState(BLANK);
  const [saving,      setSaving]      = useState(false);
  const [modalError,  setModalError]  = useState('');

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/companies');
      setCompanies(res.data.data ?? []);
    } catch {
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const openCreate = () => { setEditing(null); setForm(BLANK); setModalError(''); setShowModal(true); };
  const openEdit   = (c) => {
    setEditing(c);
    setForm({ name: c.name, code: c.code, industry: c.industry || '', description: c.description || '' });
    setModalError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setModalError('');
    try {
      if (editing) {
        await api.put(`/api/companies/${editing.company_id}`, form);
        setSuccess(`Company "${form.name}" updated.`);
      } else {
        await api.post('/api/companies', form);
        setSuccess(`Company "${form.name}" created.`);
      }
      setShowModal(false);
      fetchCompanies();
    } catch (err) {
      setModalError(err.response?.data?.error || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (c) => {
    if (!window.confirm(`Deactivate "${c.name}"?`)) return;
    try {
      await api.delete(`/api/companies/${c.company_id}`);
      setSuccess(`Company "${c.name}" deactivated.`);
      fetchCompanies();
    } catch (err) {
      setError(err.response?.data?.error || 'Deactivate failed.');
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="fw-bold mb-0">Companies</h5>
        <Button variant="primary" onClick={openCreate}>
          <i className="bi bi-plus-lg me-1" />Add Company
        </Button>
      </div>

      {error   && <Alert variant="danger"  dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : companies.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-buildings display-5 d-block mb-2" />
              No companies yet
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Name</th>
                    <th>Code</th>
                    <th>Industry</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {companies.map((c) => (
                    <tr key={c.company_id}>
                      <td className="fw-semibold">{c.name}</td>
                      <td><code>{c.code}</code></td>
                      <td className="text-muted">{c.industry || '—'}</td>
                      <td>
                        <Badge bg={c.is_active ? 'success' : 'secondary'}>
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button size="sm" variant="outline-primary" onClick={() => openEdit(c)}>Edit</Button>
                          {c.is_active && (
                            <Button size="sm" variant="outline-danger" onClick={() => handleDeactivate(c)}>Deactivate</Button>
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

      {/* Create / Edit modal */}
      <Modal show={showModal} onHide={() => { setShowModal(false); setModalError(''); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? 'Edit Company' : 'New Company'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalError && <Alert variant="danger" className="py-2">{modalError}</Alert>}
          <Row className="g-3">
            <Col md={8}>
              <Form.Label>Name <span className="text-danger">*</span></Form.Label>
              <Form.Control value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Col>
            <Col md={4}>
              <Form.Label>Code <span className="text-danger">*</span></Form.Label>
              <Form.Control value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="ACME" />
            </Col>
            <Col md={12}>
              <Form.Label>Industry</Form.Label>
              <Form.Control value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} placeholder="Finance, Healthcare…" />
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
          <Button variant="primary" onClick={handleSave} disabled={saving || !form.name || !form.code}>
            {saving ? <><Spinner size="sm" className="me-2" />Saving…</> : (editing ? 'Save' : 'Create')}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
