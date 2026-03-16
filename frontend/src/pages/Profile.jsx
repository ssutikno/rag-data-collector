import { useState, useEffect } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

export default function Profile() {
  const { user, fetchProfile } = useAuth();

  // ── Basic info ────────────────────────────────────────────────────────────
  const [info, setInfo]           = useState({ full_name: '', job_title: '', phone: '' });
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg]     = useState(null); // { type, text }

  // ── Organisation ─────────────────────────────────────────────────────────
  const [companies, setCompanies] = useState([]);
  const [depts, setDepts]         = useState([]);
  const [subDepts, setSubDepts]   = useState([]);
  const [org, setOrg]             = useState({ company_id: '', department_id: '', sub_dept_id: '' });
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgMsg, setOrgMsg]       = useState(null);

  // ── Password ──────────────────────────────────────────────────────────────
  const [pwd, setPwd]             = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg]       = useState(null);

  // Seed form from user profile
  useEffect(() => {
    if (!user) return;
    setInfo({
      full_name: user.full_name || '',
      job_title: user.job_title || '',
      phone:     user.phone     || '',
    });
    setOrg({
      company_id:    user.company_id    ? String(user.company_id)    : '',
      department_id: user.department_id ? String(user.department_id) : '',
      sub_dept_id:   user.sub_dept_id   ? String(user.sub_dept_id)   : '',
    });
  }, [user]);

  // Load companies on mount
  useEffect(() => {
    api.get('/api/public/companies').then((r) => setCompanies(r.data.data || [])).catch(() => {});
  }, []);

  // Load departments when company changes
  useEffect(() => {
    if (!org.company_id) { setDepts([]); return; }
    api.get(`/api/public/departments?company_id=${org.company_id}`)
      .then((r) => setDepts(r.data.data || []))
      .catch(() => setDepts([]));
  }, [org.company_id]);

  // Load sub-departments when department changes
  useEffect(() => {
    if (!org.department_id) { setSubDepts([]); return; }
    api.get(`/api/public/sub-departments?department_id=${org.department_id}`)
      .then((r) => setSubDepts(r.data.data || []))
      .catch(() => setSubDepts([]));
  }, [org.department_id]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleInfoChange = (e) =>
    setInfo((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleOrgChange = (e) => {
    const { name, value } = e.target;
    setOrg((f) => {
      const next = { ...f, [name]: value };
      if (name === 'company_id') { next.department_id = ''; next.sub_dept_id = ''; }
      if (name === 'department_id') { next.sub_dept_id = ''; }
      return next;
    });
  };

  const handlePwdChange = (e) =>
    setPwd((f) => ({ ...f, [e.target.name]: e.target.value }));

  const saveInfo = async (e) => {
    e.preventDefault();
    setInfoMsg(null);
    setInfoSaving(true);
    try {
      await api.put('/api/profile', {
        full_name: info.full_name,
        job_title: info.job_title,
        phone:     info.phone,
      });
      await fetchProfile();
      setInfoMsg({ type: 'success', text: 'Profile updated.' });
    } catch (err) {
      setInfoMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to update profile.' });
    } finally {
      setInfoSaving(false);
    }
  };

  const saveOrg = async (e) => {
    e.preventDefault();
    setOrgMsg(null);
    setOrgSaving(true);
    try {
      await api.put('/api/profile', {
        update_org:    true,
        company_id:    org.company_id    ? parseInt(org.company_id, 10)    : null,
        department_id: org.department_id ? parseInt(org.department_id, 10) : null,
        sub_dept_id:   org.sub_dept_id   ? parseInt(org.sub_dept_id, 10)   : null,
      });
      await fetchProfile();
      setOrgMsg({ type: 'success', text: 'Organisation updated.' });
    } catch (err) {
      setOrgMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to update organisation.' });
    } finally {
      setOrgSaving(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwdMsg(null);
    if (pwd.new_password !== pwd.confirm_password) {
      setPwdMsg({ type: 'danger', text: 'New passwords do not match.' });
      return;
    }
    if (pwd.new_password.length < 8) {
      setPwdMsg({ type: 'danger', text: 'New password must be at least 8 characters.' });
      return;
    }
    setPwdSaving(true);
    try {
      await api.put('/api/auth/change-password', {
        current_password: pwd.current_password,
        new_password:     pwd.new_password,
      });
      setPwd({ current_password: '', new_password: '', confirm_password: '' });
      setPwdMsg({ type: 'success', text: 'Password changed successfully.' });
    } catch (err) {
      setPwdMsg({ type: 'danger', text: err.response?.data?.error || 'Failed to change password.' });
    } finally {
      setPwdSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      {/* ── Basic Info ── */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="fw-semibold">
          <i className="bi bi-person me-2" />Personal Information
        </Card.Header>
        <Card.Body>
          {infoMsg && (
            <Alert variant={infoMsg.type} className="py-2" onClose={() => setInfoMsg(null)} dismissible>
              {infoMsg.text}
            </Alert>
          )}
          <Form onSubmit={saveInfo}>
            <Form.Group className="mb-3">
              <Form.Label>Full Name</Form.Label>
              <Form.Control
                name="full_name" value={info.full_name}
                onChange={handleInfoChange} placeholder="Jane Smith"
              />
            </Form.Group>
            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Job Title</Form.Label>
                  <Form.Control
                    name="job_title" value={info.job_title}
                    onChange={handleInfoChange} placeholder="e.g. Data Analyst"
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    name="phone" value={info.phone}
                    onChange={handleInfoChange} placeholder="+1 555 000 0000"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control value={user?.email || ''} disabled />
              <Form.Text className="text-muted">Email cannot be changed.</Form.Text>
            </Form.Group>
            <div className="d-flex justify-content-end">
              <Button type="submit" variant="primary" disabled={infoSaving}>
                {infoSaving ? <><Spinner size="sm" className="me-2" />Saving…</> : 'Save Changes'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* ── Organisation ── */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="fw-semibold">
          <i className="bi bi-building me-2" />Organisation
        </Card.Header>
        <Card.Body>
          {orgMsg && (
            <Alert variant={orgMsg.type} className="py-2" onClose={() => setOrgMsg(null)} dismissible>
              {orgMsg.text}
            </Alert>
          )}
          <Form onSubmit={saveOrg}>
            <Form.Group className="mb-3">
              <Form.Label>Company</Form.Label>
              <Form.Select name="company_id" value={org.company_id} onChange={handleOrgChange}>
                <option value="">— None —</option>
                {companies.map((c) => (
                  <option key={c.company_id} value={c.company_id}>{c.name}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Department</Form.Label>
                  <Form.Select
                    name="department_id" value={org.department_id}
                    onChange={handleOrgChange} disabled={!org.company_id}
                  >
                    <option value="">— None —</option>
                    {depts.map((d) => (
                      <option key={d.department_id} value={d.department_id}>{d.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Sub-Department</Form.Label>
                  <Form.Select
                    name="sub_dept_id" value={org.sub_dept_id}
                    onChange={handleOrgChange} disabled={!org.department_id}
                  >
                    <option value="">— None —</option>
                    {subDepts.map((s) => (
                      <option key={s.sub_dept_id} value={s.sub_dept_id}>{s.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
            <div className="d-flex justify-content-end">
              <Button type="submit" variant="primary" disabled={orgSaving}>
                {orgSaving ? <><Spinner size="sm" className="me-2" />Saving…</> : 'Save Organisation'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* ── Change Password ── */}
      <Card className="mb-4 shadow-sm">
        <Card.Header className="fw-semibold">
          <i className="bi bi-shield-lock me-2" />Change Password
        </Card.Header>
        <Card.Body>
          {pwdMsg && (
            <Alert variant={pwdMsg.type} className="py-2" onClose={() => setPwdMsg(null)} dismissible>
              {pwdMsg.text}
            </Alert>
          )}
          <Form onSubmit={savePassword}>
            <Form.Group className="mb-3">
              <Form.Label>Current Password</Form.Label>
              <Form.Control
                type="password" name="current_password" required
                value={pwd.current_password} onChange={handlePwdChange}
              />
            </Form.Group>
            <Row>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>New Password</Form.Label>
                  <Form.Control
                    type="password" name="new_password" required
                    value={pwd.new_password} onChange={handlePwdChange}
                    placeholder="Min 8 characters"
                  />
                </Form.Group>
              </Col>
              <Col>
                <Form.Group className="mb-3">
                  <Form.Label>Confirm New Password</Form.Label>
                  <Form.Control
                    type="password" name="confirm_password" required
                    value={pwd.confirm_password} onChange={handlePwdChange}
                    placeholder="Repeat new password"
                  />
                </Form.Group>
              </Col>
            </Row>
            <div className="d-flex justify-content-end">
              <Button type="submit" variant="warning" disabled={pwdSaving}>
                {pwdSaving ? <><Spinner size="sm" className="me-2" />Changing…</> : 'Change Password'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
}
