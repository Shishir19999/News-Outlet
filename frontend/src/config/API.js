import axios from 'axios';
import { DEMO, API_URL } from './env';
import { demoAdapter } from '../demo/adapter';

// Full-stack mode talks to the Express API; demo mode swaps in the in-browser backend.
const API = axios.create(DEMO ? { adapter: demoAdapter } : { baseURL: API_URL });

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
