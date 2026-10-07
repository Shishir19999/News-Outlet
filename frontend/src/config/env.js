// Build-time switches. `npm run build:pages` / `npm run dev:demo` turn the demo on.
export const DEMO = import.meta.env.VITE_DEMO === 'true';
export const BASE_URL = import.meta.env.BASE_URL || '/';
export const API_URL = import.meta.env.VITE_API_URL || (DEMO ? '' : 'http://localhost:8080');
export const SITE_NAME = 'News Outlet';
