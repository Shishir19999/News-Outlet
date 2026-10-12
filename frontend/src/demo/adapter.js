// axios adapter that routes every request to the in-browser backend of the live preview.
import { AxiosError } from 'axios';
import { createDemoBackend } from './backend.js';
import { fileToDataUrl } from './images.js';
import { emitLocal } from '../lib/realtime.js';

let backend = null;
let channel = null;
export function getBackend() {
  if (!backend) {
    try { channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('news-preview-rt') : null; } catch { channel = null; }
    backend = createDemoBackend({
      storage: window.localStorage,
      // other tabs get the event over the channel; this tab is told directly
      emit: (event, payload) => { emitLocal(event, payload); if (channel) channel.postMessage({ event, payload }); },
    });
    // another tab changed the data: reload it before the next request
    window.addEventListener('storage', (e) => { if (e.key === backend.STORE_KEY) backend.invalidate(); });
  }
  return backend;
}

// Gives the preview a realistic feel: every call takes a short, slightly random time.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const latency = () => 90 + Math.random() * 180;

async function readBody(data) {
  if (typeof data === 'string') {
    try { return JSON.parse(data); } catch { return {}; }
  }
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    const out = {};
    for (const [key, value] of data.entries()) {
      if (typeof File !== 'undefined' && value instanceof File) {
        if (value.size > 0) out[key] = await fileToDataUrl(value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }
  return data || {};
}

export async function demoAdapter(config) {
  await wait(latency());
  const body = await readBody(config.data);
  const headers = {};
  const get = (name) => (config.headers && (config.headers.get ? config.headers.get(name) : config.headers[name])) || '';
  if (get('authorization')) headers.authorization = get('authorization');
  if (get('x-client-id')) headers['x-client-id'] = get('x-client-id');
  const result = getBackend().handle({ method: config.method, url: config.url, params: config.params, headers, data: body });
  const response = {
    data: JSON.parse(JSON.stringify(result.data ?? null)),
    status: result.status,
    statusText: result.status < 400 ? 'OK' : 'Error',
    headers: {},
    config,
    request: {},
  };
  if (result.status >= 200 && result.status < 300) return response;
  throw new AxiosError(`Request failed with status code ${result.status}`, AxiosError.ERR_BAD_REQUEST, config, null, response);
}

export function resetDemoData() {
  getBackend().reset();
}
