import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Card, Table, Badge, Button, Form, Row, Col,
  Spinner, InputGroup, Pagination,
} from 'react-bootstrap';
import api from '../../api/client';
import { useAuth, isContributor } from '../../contexts/AuthContext';

const DOC_TYPES = [
  '', 'policy', 'procedure', 'report', 'contract', 'invoice',
  'presentation', 'spreadsheet', 'manual', 'correspondence', 'other',
];

const STATUS_BADGE = {
  stored:           'success',
  pending_metadata: 'warning',
  archived:         'secondary',
  failed:           'danger',
};

export default function DocumentList() {
  const { user } = useAuth();

  const [docs,    setDocs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const [q,               setQ]              = useState('');
  const [filterType,      setFilterType]     = useState('');
  const [filterArchived,  setFilterArchived] = useState(false);
  const [latestOnly,      setLatestOnly]     = useState(true);

  const LIMIT = 20;

  const fetchDocs = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pg, limit: LIMIT,
        ...(q            && { q }),
        ...(filterType   && { document_type: filterType }),
        ...(filterArchived && { include_archived: 'true' }),
        ...(latestOnly    && { latest_only: 'true' }),
      });
      const res = await api.get(`/api/documents?${params}`);
      const d = res.data.data;
      setDocs(d?.data ?? []);
      setTotal(d?.total ?? 0);
      setPage(pg);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }, [q, filterType, filterArchived, latestOnly]);

  useEffect(() => { fetchDocs(1); }, [fetchDocs]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const handleSearch = (e) => {
    e.preventDefault();
    fetchDocs(1);
  };

  return (
    <div>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h5 className="fw-bold mb-0">Documents</h5>
          <p className="text-muted small mb-0">{total} document{total !== 1 ? 's' : ''} found</p>
        </div>
        {isContributor(user) && (
          <Link to="/documents/upload" className="btn btn-primary">
            <i className="bi bi-cloud-upload me-2" />Upload
          </Link>
        )}
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Form onSubmit={handleSearch}>
            <Row className="g-2 align-items-end">
              <Col xs={12} md={5}>
                <InputGroup>
                  <InputGroup.Text><i className="bi bi-search" /></InputGroup.Text>
                  <Form.Control
                    placeholder="Search by title, filename, tags…"
                    value={q} onChange={(e) => setQ(e.target.value)}
                  />
                </InputGroup>
              </Col>
              <Col xs={6} md={3}>
                <Form.Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  {DOC_TYPES.filter(Boolean).map((t) => (
                    <option key={t} value={t} className="text-capitalize">{t}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs="auto">
                <Form.Check
                  type="switch" id="latest-only" label="Latest only"
                  checked={latestOnly} onChange={(e) => setLatestOnly(e.target.checked)}
                />
              </Col>
              <Col xs="auto">
                <Form.Check
                  type="switch" id="include-archived" label="Show archived"
                  checked={filterArchived} onChange={(e) => setFilterArchived(e.target.checked)}
                />
              </Col>
              <Col xs="auto">
                <Button type="submit" variant="primary">Search</Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : docs.length === 0 ? (
            <div className="text-center text-muted py-5">
              <i className="bi bi-inbox display-5 d-block mb-2" />
              No documents found
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th style={{ minWidth: 220 }}>Title / File</th>
                    <th>Type</th>
                    <th>MIME</th>
                    <th>Version</th>
                    <th>Access</th>
                    <th>Status</th>
                    <th>Uploaded</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {docs.map((doc) => (
                    <tr key={doc.document_id} className="doc-row">
                      <td>
                        <div className="fw-semibold">{doc.title || doc.file_name}</div>
                        <div className="text-muted small">
                          {doc.title && <span className="me-2">{doc.file_name}</span>}
                          {doc.file_size_bytes ? (
                            <span className="text-muted">
                              {doc.file_size_bytes >= 1048576
                                ? `${(doc.file_size_bytes/1048576).toFixed(2)} MB`
                                : `${(doc.file_size_bytes/1024).toFixed(1)} KB`}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <Badge bg="light" text="dark" className="text-capitalize">{doc.document_type}</Badge>
                      </td>
                      <td className="text-muted small" style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {doc.file_mime_type || '—'}
                      </td>
                      <td className="text-muted">{doc.version || '—'}</td>
                      <td>
                        <Badge bg="light" text="dark" className="text-capitalize">
                          {doc.access_level?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={STATUS_BADGE[doc.status] || 'secondary'}>
                          {doc.status}
                        </Badge>
                      </td>
                      <td className="text-muted small">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <Link
                          to={`/documents/${doc.document_id}`}
                          className="btn btn-sm btn-outline-primary"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>

        {/* Pagination */}
        {totalPages > 1 && (
          <Card.Footer className="bg-white d-flex justify-content-between align-items-center">
            <span className="text-muted small">
              Page {page} of {totalPages} · {total} results
            </span>
            <Pagination size="sm" className="mb-0">
              <Pagination.Prev disabled={page === 1} onClick={() => fetchDocs(page - 1)} />
              {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                const p = i + 1;
                return (
                  <Pagination.Item key={p} active={p === page} onClick={() => fetchDocs(p)}>
                    {p}
                  </Pagination.Item>
                );
              })}
              <Pagination.Next disabled={page === totalPages} onClick={() => fetchDocs(page + 1)} />
            </Pagination>
          </Card.Footer>
        )}
      </Card>
    </div>
  );
}
