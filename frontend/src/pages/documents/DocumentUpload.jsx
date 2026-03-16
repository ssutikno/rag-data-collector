import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Button, Row, Col, Alert, Spinner, Badge,
} from 'react-bootstrap';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

const DOC_TYPES = [
  'policy', 'procedure', 'report', 'contract', 'invoice',
  'presentation', 'spreadsheet', 'manual', 'correspondence', 'other',
];
const ACCESS_LEVELS = ['public', 'company', 'department', 'sub_department', 'restricted', 'confidential'];
const UPDATE_FREQ   = ['real_time', 'daily', 'weekly', 'monthly', 'quarterly', 'annually', 'ad_hoc', 'one_time'];

export default function DocumentUpload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [file,    setFile]    = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  // Org options for admins
  const [companies,   setCompanies]   = useState([]);
  const [departments, setDepartments] = useState([]);
  const [subDepts,    setSubDepts]    = useState([]);

  const isAdmin = user?.role === 'system_admin' || user?.role === 'dept_admin';

  const [meta, setMeta] = useState({
    title: '', document_type: 'report', description: '',
    tags: '', version: '1.0', access_level: 'company',
    date_created: '', update_frequency: 'ad_hoc', language: 'EN',
    // org — pre-filled from JWT
    company_id:    user?.company_id    ?? '',
    department_id: user?.department_id ?? '',
    sub_dept_id:   user?.sub_dept_id   ?? '',
  });

  // Load companies — always needed for name resolution
  useEffect(() => {
    api.get('/api/companies').then((r) => setCompanies(r.data.data ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    const cid = meta.company_id || user?.company_id;
    if (!cid) return;
    api.get(`/api/departments?company_id=${cid}`)
      .then((r) => setDepartments(r.data.data ?? []))
      .catch(() => {});
  }, [meta.company_id, user?.company_id]);

  useEffect(() => {
    const did = meta.department_id || user?.department_id;
    if (!did) return;
    api.get(`/api/sub-departments?department_id=${did}`)
      .then((r) => setSubDepts(r.data.data ?? []))
      .catch(() => {});
  }, [meta.department_id, user?.department_id]);

  const handleMetaChange = (e) => {
    const { name, value } = e.target;
    setMeta((m) => ({ ...m, [name]: value }));
    // Reset downstream org selections
    if (name === 'company_id')    setMeta((m) => ({ ...m, company_id: value, department_id: '', sub_dept_id: '' }));
    if (name === 'department_id') setMeta((m) => ({ ...m, department_id: value, sub_dept_id: '' }));
  };

  // ── Drag & drop ──────────────────────────
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = ()  => setDragging(false);

  const onFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  // ── Submit ────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { setError('Please select a file to upload.'); return; }
    setError('');
    setLoading(true);

    try {
      const fd = new FormData();
      fd.append('file', file);
      Object.entries(meta).forEach(([k, v]) => {
        if (k === 'tags') {
          const tagArray = String(v).trim().split(/\s+/).filter(Boolean);
          if (tagArray.length > 0) fd.append('tags', JSON.stringify(tagArray));
        } else if (v !== '' && v != null) {
          fd.append(k, v);
        }
      });

      const res = await api.post('/api/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const docId = res.data.data?.document_id;
      navigate(docId ? `/documents/${docId}` : '/documents');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Upload failed.');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (b) => {
    if (b < 1024)       return `${b} B`;
    if (b < 1048576)    return `${(b/1024).toFixed(1)} KB`;
    return `${(b/1048576).toFixed(1)} MB`;
  };

  return (
    <div style={{ maxWidth: 780 }}>
      <h5 className="fw-bold mb-4">Upload Document</h5>

      {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}

      <Form onSubmit={handleSubmit}>
        {/* Drop zone */}
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body>
            <h6 className="fw-semibold mb-3">File</h6>
            <div
              className={`drop-zone text-center p-5 ${dragging ? 'drag-over' : ''}`}
              onDrop={onDrop} onDragOver={onDragOver} onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef} type="file" className="d-none"
                onChange={onFileSelect}
              />
              {file ? (
                <div>
                  <i className="bi bi-file-earmark-check display-5 text-success d-block mb-2" />
                  <div className="fw-semibold">{file.name}</div>
                  <div className="text-muted small">{formatBytes(file.size)}</div>
                  <Badge bg="light" text="dark" className="mt-2">{file.type || 'unknown type'}</Badge>
                </div>
              ) : (
                <div>
                  <i className="bi bi-cloud-upload display-5 text-primary d-block mb-2" />
                  <div className="fw-semibold">Drag & drop a file here</div>
                  <div className="text-muted small">or click to browse · max 100 MB</div>
                </div>
              )}
            </div>
            {file && (
              <Button
                size="sm" variant="outline-secondary" className="mt-2"
                onClick={(e) => { e.stopPropagation(); setFile(null); if (fileInputRef.current) fileInputRef.current.value=''; }}
              >
                <i className="bi bi-x me-1" />Remove
              </Button>
            )}
          </Card.Body>
        </Card>

        {/* Metadata */}
        <Card className="border-0 shadow-sm mb-4">
          <Card.Body>
            <h6 className="fw-semibold mb-3">Metadata</h6>

            <Form.Group className="mb-3">
              <Form.Label>Title <span className="text-danger">*</span></Form.Label>
              <Form.Control
                name="title" required value={meta.title}
                onChange={handleMetaChange} placeholder="Descriptive document title"
              />
            </Form.Group>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Label>Document Type <span className="text-danger">*</span></Form.Label>
                <Form.Select name="document_type" value={meta.document_type} onChange={handleMetaChange}>
                  {DOC_TYPES.map((t) => (
                    <option key={t} value={t} className="text-capitalize">{t}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={6}>
                <Form.Label>Version</Form.Label>
                <Form.Control
                  name="version" value={meta.version}
                  onChange={handleMetaChange} placeholder="1.0"
                />
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea" rows={3} name="description"
                value={meta.description} onChange={handleMetaChange}
                placeholder="Brief summary of the document content"
              />
            </Form.Group>

            <Row className="g-3 mb-3">
              <Col md={6}>
                <Form.Label>Tags</Form.Label>
                <Form.Control
                  name="tags" value={meta.tags}
                  onChange={handleMetaChange} placeholder="tag1 tag2 tag3 (space-separated)"
                />
                <Form.Text className="text-muted">Space-separated list of keywords</Form.Text>
              </Col>
              <Col md={6}>
                <Form.Label>Access Level</Form.Label>
                <Form.Select name="access_level" value={meta.access_level} onChange={handleMetaChange}>
                  {ACCESS_LEVELS.map((a) => (
                    <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                  ))}
                </Form.Select>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col md={4}>
                <Form.Label>Document Date</Form.Label>
                <Form.Control
                  type="date" name="date_created"
                  value={meta.date_created} onChange={handleMetaChange}
                />
              </Col>
              <Col md={4}>
                <Form.Label>Update Frequency</Form.Label>
                <Form.Select name="update_frequency" value={meta.update_frequency} onChange={handleMetaChange}>
                  {UPDATE_FREQ.map((f) => (
                    <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={4}>
                <Form.Label>Language</Form.Label>
                <Form.Control
                  name="language" value={meta.language}
                  onChange={handleMetaChange} placeholder="EN"
                  maxLength={10}
                />
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Org info — read-only for regular users */}
        {!isAdmin && (
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body>
              <h6 className="fw-semibold mb-3">
                <i className="bi bi-buildings me-2 text-muted" />
                Organisation
              </h6>
              {user?.company_id ? (
                <Row className="g-3">
                  <Col md={4}>
                    <div className="text-muted small mb-1">Company</div>
                    <div className="fw-semibold">
                      {companies.find((c) => String(c.company_id) === String(user.company_id))?.name ?? `ID: ${user.company_id}`}
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="text-muted small mb-1">Department</div>
                    <div className="fw-semibold">
                      {user.department_id
                        ? (departments.find((d) => String(d.department_id) === String(user.department_id))?.name ?? `ID: ${user.department_id}`)
                        : <span className="text-muted">—</span>}
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="text-muted small mb-1">Sub-Department</div>
                    <div className="fw-semibold">
                      {user.sub_dept_id
                        ? (subDepts.find((s) => String(s.sub_dept_id) === String(user.sub_dept_id))?.name ?? `ID: ${user.sub_dept_id}`)
                        : <span className="text-muted">—</span>}
                    </div>
                  </Col>
                </Row>
              ) : (
                <Alert variant="warning" className="py-2 mb-0">
                  <i className="bi bi-exclamation-triangle me-2" />
                  Your account has no organisation assigned. Contact an admin before uploading.
                </Alert>
              )}
            </Card.Body>
          </Card>
        )}

        {/* Org override — only for admins */}
        {isAdmin && (
          <Card className="border-0 shadow-sm mb-4">
            <Card.Body>
              <h6 className="fw-semibold mb-3">
                <i className="bi bi-buildings me-2 text-muted" />
                Organisation (admin override)
              </h6>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Label>Company</Form.Label>
                  <Form.Select name="company_id" value={meta.company_id} onChange={handleMetaChange}>
                    <option value="">Select company…</option>
                    {companies.map((c) => (
                      <option key={c.company_id} value={c.company_id}>{c.name}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label>Department</Form.Label>
                  <Form.Select name="department_id" value={meta.department_id} onChange={handleMetaChange} disabled={!meta.company_id}>
                    <option value="">Select department…</option>
                    {departments.map((d) => (
                      <option key={d.department_id} value={d.department_id}>{d.name}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label>Sub-Department</Form.Label>
                  <Form.Select name="sub_dept_id" value={meta.sub_dept_id} onChange={handleMetaChange} disabled={!meta.department_id}>
                    <option value="">Select sub-dept…</option>
                    {subDepts.map((s) => (
                      <option key={s.sub_dept_id} value={s.sub_dept_id}>{s.name}</option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
              {!user?.company_id && (
                <Alert variant="warning" className="mt-3 py-2 mb-0">
                  <i className="bi bi-exclamation-triangle me-2" />
                  Your account has no organisation assigned. Please select one above or contact an admin.
                </Alert>
              )}
            </Card.Body>
          </Card>
        )}

        {!isAdmin && !user?.company_id && null}

        <div className="d-flex gap-2">
          <Button type="submit" variant="primary" disabled={loading || (!isAdmin && !user?.company_id)}>
            {loading
              ? <><Spinner size="sm" className="me-2" />Uploading…</>
              : <><i className="bi bi-cloud-upload me-2" />Upload Document</>
            }
          </Button>
          <Button variant="outline-secondary" onClick={() => navigate('/documents')}>
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
}
