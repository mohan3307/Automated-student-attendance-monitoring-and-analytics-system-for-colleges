import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.PROD ? 'https://automated-student-attendance-monitoring-kbmz.onrender.com/api' : '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('attendedge_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('attendedge_token');
      localStorage.removeItem('attendedge_user');
      const loginPath = `${import.meta.env.BASE_URL}login`.replace(/\/+/g, '/');
      if (!window.location.pathname.endsWith('/login')) {
        window.location.href = loginPath;
      }
    }
    return Promise.reject(err);
  }
);

export default api;
