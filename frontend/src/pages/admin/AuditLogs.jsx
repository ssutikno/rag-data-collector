import { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Badge, Form, Row, Col,
  Spinner, InputGroup, Button,
} from 'react-bootstrap';
import api from '../../api/client';

const ACTION_COLORS = {
  create:  'success',
  update:  'primary',
  delete:  'danger',
  login:   'info',
  logout:  'secondary',
  upload:  'primary',
  download:'info',
  archive: 'warning',
};

export default function AuditLogs() {
  const [logs,    setLogs]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const [filterEntity, setFilterEntity] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser,   setFilterUser]   = useState('');

  const LIMIT = 30;

  const fetchLogs = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pg, limit: LIMIT,
        ...(filterEntity && { entity_type: filterEntity }),
        ...(filterAction && { action: filterAction }),
        ...(filterUser   && { performed_by: filterUser }),
      });
      const res = await api.get(`/api/admin/audit-logs?${params}`);
      const d = res.data.data;
      setLogs(d?.data ?? []);
      setTotal(d?.total ?? 0);
      setPage(pg);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filterEntity, filterAction, filterUser]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  const totalPages = Math.ceil(total / LIMIT) || 1;

  return (
    <div>
      <h5 className="fw-bold mb-3">Audit Logs</h5>

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col xs={6} md={3}>
              <Form.Control
                placeholder="Entity type (e.g. document)"
                value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLogs(1)}
              />
            </Col>
            <Col xs={6} md={3}>
              <Form.Control
                placeholder="Action (e.g. upload)"
                value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchLogs(1)}
              />
            </Col>
            <Col xs={6} md={3}>
              <InputGroup>
                <InputGroup.Text><i className="bi bi-person" /></InputGroup.Text>
                <Form.Control
                  type="number" placeholder="User ID"
                  value={filterUser} onChange={(e) => setFilterUser(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLogs(1)}
                />
              </InputGroup>
            </Col>
            <Col xs="auto">
              <Button variant="primary" onClick={() => fetchLogs(1)}>Filter</Button>
              <Button variant="outline-secondary" className="ms-2" onClick={() => {
                setFilterEntity(''); setFilterAction(''); setFilterUser('');
              }}>Reset</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
          <span className="fw-semibold">Events <Badge bg="secondary">{total}</Badge></span>
          <div className="d-flex gap-2">
            <Button size="sm" variant="outline-secondary" disabled={page === 1} onClick={() => fetchLogs(page - 1)}>
              <i className="bi bi-chevron-left" />
            </Button>
            <span className="small text-muted align-self-center">Page {page}/{totalPages}</span>
            <Button size="sm" variant="outline-secondary" disabled={page === totalPages} onClick={() => fetchLogs(page + 1)}>
              <i className="bi bi-chevron-right" />
            </Button>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : logs.length === 0 ? (
            <div className="text-center text-muted py-5">No audit events found</div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0 small">
                <thead className="table-light">
                  <tr>
                    <th>#</th>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Entity ID</th>
                    <th>User ID</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.log_id}>
                      <td className="text-muted">{log.log_id}</td>
                      <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <Badge bg={ACTION_COLORS[log.action] ?? 'secondary'}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="text-capitalize">{log.entity_type}</td>
                      <td className="text-muted">{log.entity_id ?? '—'}</td>
                      <td className="text-muted">{log.performed_by ?? '—'}</td>
                      <td className="text-muted">{log.ip_address ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
