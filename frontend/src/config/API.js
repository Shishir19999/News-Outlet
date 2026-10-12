import axios from 'axios';
import { DEMO, API_URL } from './env';
import { demoAdapter } from '../demo/adapter';

// Real mode talks to the Express API; the live preview swaps in the in-browser backend.
const API = axios.create(DEMO ? { adapter: demoAdapter } : { baseURL: API_URL });

// A random id for this browser: lets anonymous readers react and vote once without an account.
export function clientId() {
  try {
    let id = localStorage.getItem('news-client-id');
    if (!id) {
      id = `c${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      localStorage.setItem('news-client-id', id);
    }
    return id;
  } catch {
    return 'anonymous-session';
  }
}
API.interceptors.request.use((config) => {
  config.headers.set('x-client-id', clientId());
  return config;
});

export const authHeaders = () => ({ authorization: localStorage.getItem('token') || '' });

// Human readable message for a failed request.
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error && error.response && error.response.data;
  if (data) {
    if (typeof data.message === 'string') return data.message;
    const first = Object.values(data).find((v) => typeof v === 'string');
    if (first) return first;
  }
  if (error && error.code === 'ERR_NETWORK') return 'Cannot reach the server. Check your connection and try again.';
  return fallback;
}

export default API;
