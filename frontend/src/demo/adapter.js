// axios adapter that routes every request to the in-browser demo backend.
import { AxiosError } from 'axios';
import { createDemoBackend } from './backend.js';
import { fileToDataUrl } from './images.js';

let backend = null;
export function getBackend() {
  if (!backend) backend = createDemoBackend({ storage: window.localStorage });
  return backend;
}

// Gives the demo a realistic feel: every call takes a short, slightly random time.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const latency = () => 140 + Math.random() * 260;

async function readBody(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch {
      return {};
    }
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
  const auth = config.headers && (config.headers.get ? config.headers.get('authorization') : config.headers.authorization);
  if (auth) headers.authorization = auth;
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
