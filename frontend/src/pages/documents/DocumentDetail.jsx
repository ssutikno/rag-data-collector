import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Card, Badge, Button, Form, Row, Col, Alert, Spinner, Modal, Table,
} from 'react-bootstrap';
import api from '../../api/client';
import { useAuth } from '../../contexts/AuthContext';

const DOC_TYPES     = ['policy','procedure','report','contract','invoice','presentation','spreadsheet','manual','correspondence','other'];
const ACCESS_LEVELS = ['public','company','department','sub_department','restricted','confidential'];
const UPDATE_FREQ   = ['real_time','daily','weekly','monthly','quarterly','annually','ad_hoc','one_time'];

const STATUS_BADGE = {
  stored: 'success', pending_metadata: 'warning', archived: 'secondary', failed: 'danger',
};

export default function DocumentDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [doc,       setDoc]      = useState(null);
  const [versions,  setVersions] = useState([]);
  const [loading,   setLoading]  = useState(true);
  const [error,     setError]    = useState('');
  const [success,   setSuccess]  = useState('');

  // Metadata edit
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [editForm, setEditForm] = useState({});

  // New version upload
  const [showVersionModal, setShowVersionModal]   = useState(false);
  const [versionFile,      setVersionFile]        = useState(null);
  const [versionMeta,      setVersionMeta]        = useState({ version: '', description: '' });
  const [uploadingVersion, setUploadingVersion]   = useState(false);

  // Replace file
  const [showReplaceModal, setShowReplaceModal]   = useState(false);
  const [replaceFile,      setReplaceFile]        = useState(null);
  const [replacingFile,    setReplacingFile]      = useState(false);

  const canEdit = () =>
    user?.user_id === doc?.uploader_user_id ||
    ['system_admin', 'dept_admin'].includes(user?.role);

  const canArchive = () => ['system_admin', 'dept_admin'].includes(user?.role);

  // ── Load ──────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [docRes, verRes] = await Promise.all([
          api.get(`/api/documents/${id}`),
          api.get(`/api/documents/${id}/versions`),
        ]);
        if (!cancelled) {
          const d = docRes.data.data;
          setDoc(d);
          setEditForm({
            title:            d.title,
            document_type:    d.document_type,
            description:      d.description || '',
            tags:             Array.isArray(d.tags) ? d.tags.join(' ') : (d.tags || ''),
            version:          d.version || '',
            access_level:     d.access_level,
            date_created:     d.date_created?.split('T')[0] || '',
            update_frequency: d.update_frequency || 'ad_hoc',
            language:         d.language || 'EN',
          });
          setVersions(verRes.data.data ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Failed to load document.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  // ── Download ──────────────────────────────
  const handleDownload = async () => {
    try {
      const res = await api.get(`/api/documents/${id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href    = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Download failed.');
    }
  };

  // ── Save metadata ─────────────────────────
  const handleSaveMeta = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...editForm,
        tags: editForm.tags.trim().split(/\s+/).filter(Boolean),
      };
      await api.put(`/api/documents/${id}/metadata`, payload);
      setSuccess('Metadata updated successfully.');
      setEditing(false);
      // Refresh
      const res = await api.get(`/api/documents/${id}`);
      const d = res.data.data;
      setDoc(d);
      setEditForm((f) => ({
        ...f,
        tags: Array.isArray(d.tags) ? d.tags.join(' ') : (d.tags || ''),
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  // ── Replace file ──────────────────────────
  const handleReplaceFile = async () => {
    if (!replaceFile) return;
    setReplacingFile(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', replaceFile);
      const res = await api.put(`/api/documents/${id}/file`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDoc(res.data.data);
      setShowReplaceModal(false);
      setReplaceFile(null);
      setSuccess('File replaced successfully.');
    } catch (err) {
      setError(err.response?.data?.error || 'File replacement failed.');
    } finally {
      setReplacingFile(false);
    }
  };

  // ── Archive ───────────────────────────────
  const handleArchive = async () => {
    if (!window.confirm('Archive this document? It will no longer be downloadable.')) return;
    try {
      await api.put(`/api/documents/${id}/archive`);
      setSuccess('Document archived.');
      setDoc((d) => ({ ...d, status: 'archived' }));
    } catch (err) {
      setError(err.response?.data?.error || 'Archive failed.');
    }
  };

  // ── Upload new version ────────────────────
  const handleUploadVersion = async () => {
    if (!versionFile) return;
    setUploadingVersion(true);
    try {
      const fd = new FormData();
      fd.append('file', versionFile);
      if (versionMeta.version)     fd.append('version', versionMeta.version);
      if (versionMeta.description) fd.append('description', versionMeta.description);

      await api.post(`/api/documents/${id}/new-version`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setShowVersionModal(false);
      setVersionFile(null);
      setVersionMeta({ version: '', description: '' });
      setSuccess('New version uploaded.');
      // Refresh versions
      const verRes = await api.get(`/api/documents/${id}/versions`);
      setVersions(verRes.data.data ?? []);
    } catch (err) {
      setError(err.response?.data?.error || 'Version upload failed.');
    } finally {
      setUploadingVersion(false);
    }
  };

  if (loading) return <div className="text-center py-5"><Spinner /></div>;
  if (!doc)    return <Alert variant="danger">{error || 'Document not found.'}</Alert>;

  return (
    <div style={{ maxWidth: 860 }}>
      {/* Back */}
      <Button variant="link" className="text-muted px-0 mb-3" onClick={() => navigate('/documents')}>
        <i className="bi bi-arrow-left me-1" />Back to Documents
      </Button>

      {error   && <Alert variant="danger"   dismissible onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert variant="success"  dismissible onClose={() => setSuccess('')}>{success}</Alert>}

      {/* Header card */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
            <div>
              <h5 className="fw-bold mb-1">{doc.title || doc.file_name}</h5>
              <div className="d-flex flex-wrap gap-2">
                <Badge bg={STATUS_BADGE[doc.status] || 'secondary'}>{doc.status}</Badge>
                <Badge bg="light" text="dark" className="text-capitalize">{doc.document_type}</Badge>
                <Badge bg="light" text="dark" className="text-capitalize">{doc.access_level?.replace('_',' ')}</Badge>
                {doc.is_latest_version && <Badge bg="primary">Latest</Badge>}
              </div>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {doc.status !== 'archived' && (
                <Button variant="outline-success" size="sm" onClick={handleDownload}>
                  <i className="bi bi-download me-1" />Download
                </Button>
              )}
              {canEdit() && !editing && (
                <Button variant="outline-primary" size="sm" onClick={() => setEditing(true)}>
                  <i className="bi bi-pencil me-1" />Edit Metadata
                </Button>
              )}
              {canEdit() && doc.status !== 'archived' && (
                <Button variant="outline-warning" size="sm" onClick={() => setShowReplaceModal(true)}>
                  <i className="bi bi-arrow-repeat me-1" />Replace File
                </Button>
              )}
              {canEdit() && doc.status !== 'archived' && (
                <Button variant="outline-primary" size="sm" onClick={() => setShowVersionModal(true)}>
                  <i className="bi bi-layers me-1" />New Version
                </Button>
              )}
              {canArchive() && doc.status !== 'archived' && (
                <Button variant="outline-danger" size="sm" onClick={handleArchive}>
                  <i className="bi bi-archive me-1" />Archive
                </Button>
              )}
            </div>
          </div>

          <hr />

          <Row className="g-3 small">
            <Col xs={6} md={3}><span className="text-muted d-block">File Name</span><span style={{wordBreak:'break-all'}}>{doc.file_name || '—'}</span></Col>
            <Col xs={6} md={3}><span className="text-muted d-block">MIME Type</span>{doc.file_mime_type || '—'}</Col>
            <Col xs={6} md={3}><span className="text-muted d-block">File Size</span>{doc.file_size_bytes ? (doc.file_size_bytes >= 1048576 ? `${(doc.file_size_bytes/1048576).toFixed(2)} MB` : `${(doc.file_size_bytes/1024).toFixed(1)} KB`) : '—'}</Col>
            <Col xs={6} md={3}><span className="text-muted d-block">Version</span>{doc.version || '—'}</Col>
            <Col xs={6} md={3}><span className="text-muted d-block">Language</span>{doc.language || '—'}</Col>
            <Col xs={6} md={3}><span className="text-muted d-block">Date Created</span>{doc.date_created?.split('T')[0] || '—'}</Col>
            <Col xs={6} md={3}><span className="text-muted d-block">Update Freq.</span>{doc.update_frequency || '—'}</Col>
            <Col xs={6} md={3}><span className="text-muted d-block">SHA-256</span>
              <span title={doc.file_hash} style={{ fontFamily: 'monospace', fontSize:'0.7rem' }}>
                {doc.file_hash?.slice(0,16)}…
              </span>
            </Col>
          </Row>

          {doc.tags?.length > 0 && (
            <div className="mt-3">
              {(Array.isArray(doc.tags) ? doc.tags : doc.tags.split(' ')).map((t) => (
                <Badge key={t} bg="secondary" className="me-1">{t}</Badge>
              ))}
            </div>
          )}

          {doc.description && (
            <p className="mt-3 mb-0 text-muted small">{doc.description}</p>
          )}
        </Card.Body>
      </Card>

      {/* Metadata editor */}
      {editing && (
        <Card className="border-0 shadow-sm mb-4">
          <Card.Header className="bg-white fw-semibold">Edit Metadata</Card.Header>
          <Card.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Title</Form.Label>
                <Form.Control value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              </Form.Group>

              <Row className="g-3 mb-3">
                <Col md={4}>
                  <Form.Label>Document Type</Form.Label>
                  <Form.Select value={editForm.document_type}
                    onChange={(e) => setEditForm((f) => ({ ...f, document_type: e.target.value }))}>
                    {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label>Access Level</Form.Label>
                  <Form.Select value={editForm.access_level}
                    onChange={(e) => setEditForm((f) => ({ ...f, access_level: e.target.value }))}>
                    {ACCESS_LEVELS.map((a) => <option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label>Version</Form.Label>
                  <Form.Control value={editForm.version}
                    onChange={(e) => setEditForm((f) => ({ ...f, version: e.target.value }))} />
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control as="textarea" rows={3} value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              </Form.Group>

              <Row className="g-3 mb-3">
                <Col md={6}>
                  <Form.Label>Tags (space-separated)</Form.Label>
                  <Form.Control value={editForm.tags}
                    onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))} />
                </Col>
                <Col md={3}>
                  <Form.Label>Document Date</Form.Label>
                  <Form.Control type="date" value={editForm.date_created}
                    onChange={(e) => setEditForm((f) => ({ ...f, date_created: e.target.value }))} />
                </Col>
                <Col md={3}>
                  <Form.Label>Update Frequency</Form.Label>
                  <Form.Select value={editForm.update_frequency}
                    onChange={(e) => setEditForm((f) => ({ ...f, update_frequency: e.target.value }))}>
                    {UPDATE_FREQ.map((f) => <option key={f} value={f}>{f.replace(/_/g,' ')}</option>)}
                  </Form.Select>
                </Col>
              </Row>

              <div className="d-flex gap-2">
                <Button variant="primary" onClick={handleSaveMeta} disabled={saving}>
                  {saving ? <><Spinner size="sm" className="me-2" />Saving…</> : 'Save Changes'}
                </Button>
                <Button variant="outline-secondary" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      )}

      {/* Version history */}
      {versions.length > 0 && (
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white fw-semibold">
            <i className="bi bi-layers me-2" />Version History ({versions.length})
          </Card.Header>
          <Card.Body className="p-0">
            <Table hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th>Version</th>
                  <th>File</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.document_id}>
                    <td className="fw-semibold">{v.version || '—'}</td>
                    <td>{v.file_name}</td>
                    <td className="text-muted small">{new Date(v.created_at).toLocaleDateString()}</td>
                    <td>
                      {v.is_latest_version
                        ? <Badge bg="primary">Latest</Badge>
                        : <Badge bg="light" text="dark">Old</Badge>
                      }
                    </td>
                    <td>
                      {v.document_id !== parseInt(id) && (
                        <Link to={`/documents/${v.document_id}`} className="btn btn-sm btn-outline-secondary">
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/* Replace file modal */}
      <Modal show={showReplaceModal} onHide={() => { setShowReplaceModal(false); setReplaceFile(null); }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Replace File</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small mb-3">
            The existing file will be replaced. All metadata (title, tags, etc.) is preserved.
            If you want to keep the old file as a previous version, use <strong>New Version</strong> instead.
          </p>
          <Form.Group>
            <Form.Label>New File <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="file"
              onChange={(e) => setReplaceFile(e.target.files?.[0] ?? null)}
            />
          </Form.Group>
          {replaceFile && (
            <div className="mt-2 text-muted small">
              <i className="bi bi-file-earmark me-1" />{replaceFile.name} &nbsp;·&nbsp;
              {replaceFile.size >= 1048576
                ? `${(replaceFile.size/1048576).toFixed(2)} MB`
                : `${(replaceFile.size/1024).toFixed(1)} KB`}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => { setShowReplaceModal(false); setReplaceFile(null); }}>Cancel</Button>
          <Button variant="warning" onClick={handleReplaceFile} disabled={!replaceFile || replacingFile}>
            {replacingFile ? <><Spinner size="sm" className="me-2" />Replacing…</> : 'Replace File'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* New version modal */}
      <Modal show={showVersionModal} onHide={() => setShowVersionModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Upload New Version</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>File <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="file"
              onChange={(e) => setVersionFile(e.target.files?.[0] ?? null)}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>New Version Number</Form.Label>
            <Form.Control
              placeholder="e.g. 2.0"
              value={versionMeta.version}
              onChange={(e) => setVersionMeta((m) => ({ ...m, version: e.target.value }))}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Change Notes</Form.Label>
            <Form.Control
              as="textarea" rows={2}
              placeholder="Briefly describe what changed"
              value={versionMeta.description}
              onChange={(e) => setVersionMeta((m) => ({ ...m, description: e.target.value }))}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowVersionModal(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleUploadVersion} disabled={!versionFile || uploadingVersion}>
            {uploadingVersion ? <><Spinner size="sm" className="me-2" />Uploading…</> : 'Upload Version'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
