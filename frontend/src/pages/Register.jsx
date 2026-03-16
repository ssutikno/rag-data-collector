import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Spinner, Row, Col } from 'react-bootstrap';
import api from '../api/client';

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm_password: '',
    job_title: '', phone: '',
    company_id: '', department_id: '', sub_dept_id: '',
  });
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [companies, setCompanies] = useState([]);
  const [depts, setDepts]         = useState([]);
  const [subDepts, setSubDepts]   = useState([]);

  // Load companies on mount
  useEffect(() => {
    api.get('/api/public/companies').then((r) => setCompanies(r.data.data || [])).catch(() => {});
  }, []);

  // Load departments when company changes
  useEffect(() => {
    if (!form.company_id) { setDepts([]); setSubDepts([]); return; }
    api.get(`/api/public/departments?company_id=${form.company_id}`)
      .then((r) => setDepts(r.data.data || []))
      .catch(() => setDepts([]));
    setForm((f) => ({ ...f, department_id: '', sub_dept_id: '' }));
    setSubDepts([]);
  }, [form.company_id]);

  // Load sub-departments when department changes
  useEffect(() => {
    if (!form.department_id) { setSubDepts([]); return; }
    api.get(`/api/public/sub-departments?department_id=${form.department_id}`)
      .then((r) => setSubDepts(r.data.data || []))
      .catch(() => setSubDepts([]));
    setForm((f) => ({ ...f, sub_dept_id: '' }));
  }, [form.department_id]);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        full_name:        form.full_name,
        email:            form.email,
        password:         form.password,
        confirm_password: form.confirm_password,
        job_title:        form.job_title    || undefined,
        phone:            form.phone        || undefined,
        company_id:       form.company_id    ? parseInt(form.company_id, 10)    : undefined,
        department_id:    form.department_id ? parseInt(form.department_id, 10) : undefined,
        sub_dept_id:      form.sub_dept_id   ? parseInt(form.sub_dept_id, 10)   : undefined,
      };
      await api.post('/api/auth/register', payload);
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Registration failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card p-4 p-md-5" style={{ maxWidth: 520 }}>
        <div className="text-center mb-4">
          <i className="bi bi-database-fill auth-logo" />
          <h4 className="mt-2 fw-bold">Create Account</h4>
          <p className="text-muted small">Join RAG Data Collector</p>
        </div>

        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Full Name <span className="text-danger">*</span></Form.Label>
            <Form.Control
              name="full_name" required value={form.full_name}
              onChange={handleChange} placeholder="Jane Smith"
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Email Address <span className="text-danger">*</span></Form.Label>
            <Form.Control
              type="email" name="email" required value={form.email}
              onChange={handleChange} placeholder="jane@company.com"
            />
          </Form.Group>

          <Row>
            <Col>
              <Form.Group className="mb-3">
                <Form.Label>Password <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="password" name="password" required value={form.password}
                  onChange={handleChange} placeholder="Min 8 characters"
                />
              </Form.Group>
            </Col>
            <Col>
              <Form.Group className="mb-3">
                <Form.Label>Confirm Password <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  type="password" name="confirm_password" required value={form.confirm_password}
                  onChange={handleChange} placeholder="Repeat password"
                />
              </Form.Group>
            </Col>
          </Row>

          <Row>
            <Col>
              <Form.Group className="mb-3">
                <Form.Label>Job Title</Form.Label>
                <Form.Control
                  name="job_title" value={form.job_title}
                  onChange={handleChange} placeholder="e.g. Data Analyst"
                />
              </Form.Group>
            </Col>
            <Col>
              <Form.Group className="mb-3">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  name="phone" value={form.phone}
                  onChange={handleChange} placeholder="+1 555 000 0000"
                />
              </Form.Group>
            </Col>
          </Row>

          <hr className="my-3" />
          <p className="text-muted small mb-3">
            <i className="bi bi-building me-1" />Organisation (optional)
          </p>

          <Form.Group className="mb-3">
            <Form.Label>Company</Form.Label>
            <Form.Select name="company_id" value={form.company_id} onChange={handleChange}>
              <option value="">— Select company —</option>
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
                  name="department_id" value={form.department_id}
                  onChange={handleChange} disabled={!form.company_id}
                >
                  <option value="">— Select department —</option>
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
                  name="sub_dept_id" value={form.sub_dept_id}
                  onChange={handleChange} disabled={!form.department_id}
                >
                  <option value="">— Select sub-dept —</option>
                  {subDepts.map((s) => (
                    <option key={s.sub_dept_id} value={s.sub_dept_id}>{s.name}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
          </Row>

          <Button type="submit" variant="primary" className="w-100 mt-2" disabled={loading}>
            {loading ? <><Spinner size="sm" className="me-2" />Creating account…</> : 'Create Account'}
          </Button>
        </Form>

        <hr className="my-4" />
        <p className="text-center text-muted small mb-0">
          Already have an account?{' '}
          <Link to="/login" className="text-decoration-none fw-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
