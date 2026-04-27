import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 60000, // 60 seconds — puzzle generation can be slow
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  res => res,
  err => {
    if (import.meta.env.DEV) console.error('[API]', err.response?.data || err.message);
    return Promise.reject(err);
  }
);

export default api;