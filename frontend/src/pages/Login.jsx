import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm]     = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card p-4 p-md-5">
        <div className="text-center mb-4">
          <i className="bi bi-database-fill auth-logo" />
          <h4 className="mt-2 fw-bold">RAG Data Collector</h4>
          <p className="text-muted small">Sign in to your account</p>
        </div>

        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3">
            <Form.Label>Email address</Form.Label>
            <Form.Control
              type="email" name="email" required autoFocus
              value={form.email} onChange={handleChange}
              placeholder="you@company.com"
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label>Password</Form.Label>
            <Form.Control
              type="password" name="password" required
              value={form.password} onChange={handleChange}
              placeholder="••••••••"
            />
          </Form.Group>

          <Button type="submit" variant="primary" className="w-100" disabled={loading}>
            {loading ? <><Spinner size="sm" className="me-2" />Signing in…</> : 'Sign In'}
          </Button>
        </Form>

        <hr className="my-4" />
        <p className="text-center text-muted small mb-0">
          Don't have an account?{' '}
          <Link to="/register" className="text-decoration-none fw-semibold">Create one</Link>
        </p>
      </div>
    </div>
  );
}
