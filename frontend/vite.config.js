import { defineConfig } from 'vite';
import process from 'node:process';
import react from '@vitejs/plugin-react';

// Modes: default (full stack, talks to the API), `demo` (browser-only demo for local use) and
// `pages` (browser-only demo published under /News-Outlet/ on GitHub Pages).
export default defineConfig(({ mode }) => {
  const demo = mode === 'demo' || mode === 'pages' || process.env.VITE_DEMO === 'true';
  return {
    base: mode === 'pages' ? '/News-Outlet/' : '/',
    plugins: [react()],
    define: { 'import.meta.env.VITE_DEMO': JSON.stringify(demo ? 'true' : 'false') },
  };
});
