import axios from 'axios';

const api = axios.create({
  baseURL: '/',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Redirect to login on 401 (except on the login/register calls themselves, or when already there)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (
      err.response?.status === 401 &&
      !err.config.url.includes('/api/auth/login') &&
      !err.config.url.includes('/api/auth/register') &&
      window.location.pathname !== '/login' &&
      window.location.pathname !== '/register'
    ) {
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
