const http = require('node:http');
const { randomUUID } = require('node:crypto');

const PORT = 48177;
const CALLBACK = 'blackout://auth/callback';
const HOST = 'blackout-desktop';
const MAX_BODY = 4096;
const REQUEST_TTL = 10 * 60 * 1000;

const validExtensionId = value => typeof value === 'string' && /^[a-p]{32}$/.test(value);
const extensionOrigin = id => `chrome-extension://${id}`;
const originExtensionId = value => {
  if (typeof value !== 'string') return '';
  const match = /^chrome-extension:\/\/([a-p]{32})$/.exec(value);
  return match ? match[1] : '';
};
const validStart = value => Boolean(value && validExtensionId(value.extensionId)
  && /^[a-f0-9]{64}$/.test(value.state)
  && /^[A-Za-z0-9_-]{43}$/.test(value.challenge)
  && ['pactuno', 'google', 'email'].includes(value.method)
  && ['login', 'signup'].includes(value.mode));

function send(response, status, value, origin = '') {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...(origin ? {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin'
    } : {})
  });
  response.end(body);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let raw = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      raw += chunk;
      if (raw.length > MAX_BODY) reject(new Error('Request too large.'));
    });
    request.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new Error('Invalid request.')); }
    });
    request.on('error', reject);
  });
}

function createOauthBridge({ BrowserWindow, authSession, isExtensionLoaded, parentForExtension = () => null }) {
  const pending = new Map();
  let server;

  const purge = () => {
    const now = Date.now();
    for (const [id, item] of pending) if (now > item.expiresAt) pending.delete(id);
  };

  function openAuthorization(item) {
    const target = new URL('https://pactuno.online/extension/authorize.html');
    for (const [key, value] of Object.entries({
      client_id: item.extensionId,
      redirect_uri: CALLBACK,
      state: item.state,
      code_challenge: item.challenge,
      method: item.method,
      mode: item.mode,
      host: HOST
    })) target.searchParams.set(key, value);

    const parent = parentForExtension(item.extensionId);
    const window = new BrowserWindow({
      width: 520,
      height: 720,
      minWidth: 420,
      minHeight: 560,
      parent: parent || undefined,
      modal: Boolean(parent),
      show: false,
      autoHideMenuBar: true,
      backgroundColor: '#0f1019',
      title: 'Connect PacVault',
      webPreferences: {
        session: authSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true
      }
    });
    item.window = window;
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const capture = (event, targetUrl) => {
      let callback;
      try { callback = new URL(targetUrl); } catch { return; }
      if (`${callback.protocol}//${callback.host}${callback.pathname}` !== CALLBACK) return;
      event.preventDefault();
      const code = callback.searchParams.get('code') || '';
      const state = callback.searchParams.get('state') || '';
      item.result = state === item.state && /^[A-Za-z0-9_.-]{16,256}$/.test(code)
        ? { code, state }
        : { error: 'Sign-in response did not match this request.' };
      if (!window.isDestroyed()) window.close();
    };
    window.webContents.on('will-navigate', capture);
    window.webContents.on('will-redirect', capture);
    window.once('ready-to-show', () => window.show());
    window.on('closed', () => {
      if (!item.result) item.result = { error: 'Sign-in was cancelled.' };
      item.window = null;
    });
    window.loadURL(target.href).catch(() => {
      item.result = { error: 'Could not open Pactuno sign-in.' };
      if (!window.isDestroyed()) window.close();
    });
  }

  async function handle(request, response) {
    purge();
    const host = String(request.headers.host || '');
    if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) return send(response, 403, { error: 'Invalid bridge host.' });
    const origin = String(request.headers.origin || '');
    const originId = originExtensionId(origin);
    if (!originId || !isExtensionLoaded(originId)) return send(response, 403, { error: 'Installed extension origin required.' });
    if (request.method === 'OPTIONS') return send(response, 204, {}, origin);
    const url = new URL(request.url, `http://${host}`);

    if (request.method === 'POST' && url.pathname === '/oauth/start') {
      let body;
      try { body = await readJson(request); } catch (error) { return send(response, error.message === 'Request too large.' ? 413 : 400, { error: error.message }, origin); }
      if (!validStart(body) || body.extensionId !== originId) return send(response, 400, { error: 'Invalid authorization request.' }, origin);
      if (pending.size >= 10) return send(response, 429, { error: 'Too many pending sign-ins.' }, origin);
      const id = randomUUID();
      const item = { ...body, id, origin, createdAt: Date.now(), expiresAt: Date.now() + REQUEST_TTL, result: null, window: null };
      pending.set(id, item);
      openAuthorization(item);
      return send(response, 201, { requestId: id }, origin);
    }

    if (request.method === 'GET' && url.pathname === '/oauth/result') {
      const id = url.searchParams.get('id') || '';
      const item = pending.get(id);
      if (!item || item.extensionId !== originId) return send(response, 404, { error: 'Sign-in request not found or expired.' }, origin);
      if (!item.result) return send(response, 202, { pending: true }, origin);
      pending.delete(id);
      return send(response, item.result.error ? 400 : 200, item.result, origin);
    }
    return send(response, 404, { error: 'Not found.' }, origin);
  }

  return {
    start() {
      if (server) return Promise.resolve();
      return new Promise((resolve, reject) => {
        server = http.createServer((request, response) => { handle(request, response).catch(() => send(response, 500, { error: 'OAuth bridge failed.' })); });
        server.once('error', reject);
        server.listen(PORT, '127.0.0.1', resolve);
      });
    },
    stop() {
      for (const item of pending.values()) if (item.window && !item.window.isDestroyed()) item.window.close();
      pending.clear();
      return new Promise(resolve => server ? server.close(() => { server = null; resolve(); }) : resolve());
    }
  };
}

module.exports = { PORT, CALLBACK, HOST, validStart, originExtensionId, createOauthBridge };
