/* Resolves a Kaltura entry to a downloadable MP4 and hands it to the browser. */
if (typeof importScripts === 'function' && !globalThis.KV) importScripts('lib.js');

const api = globalThis.browser || globalThis.chrome;
const CDN = 'https://cdnapisec.kaltura.com';

// Per-tab state lives in storage.session: the background is suspended after ~30s idle,
// so a plain Map would lose the captured session token. Writes run one at a time.
const fresh = () => ({ urls: [], ks: [], entryId: '', partnerId: '', mediaUrl: '' });
let queue = Promise.resolve();

function withState(tabId, fn) {
  const run = queue.then(async () => {
    const key = 't' + tabId;
    const state = (await api.storage.session.get(key))[key] || fresh();
    const result = await fn(state);
    await api.storage.session.set({ [key]: state });
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

function merge(state, data) {
  if (data.entryId) state.entryId = data.entryId;
  if (data.partnerId) state.partnerId = data.partnerId;
  if (data.mediaUrl) state.mediaUrl = data.mediaUrl;
  for (const ks of data.ks || []) {
    if (ks && !state.ks.includes(ks)) state.ks.unshift(ks);
  }
  for (const url of data.urls || []) {
    if (url && !state.urls.includes(url)) state.urls.unshift(url);
  }
  state.ks = state.ks.slice(0, 5);
  state.urls = state.urls.slice(0, 40);
}

// The player's own manifest requests carry a working Kaltura session (ks),
// which is the fallback for entries that anonymous widget sessions cannot see.
// A new page load in the tab starts from a clean state.
if (api.webRequest && api.webRequest.onBeforeRequest) {
  api.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (details.tabId < 0) return;
      if (details.type === 'main_frame') {
        withState(details.tabId, (state) => Object.assign(state, fresh())).catch(() => {});
        return;
      }
      const parsed = KV.parseKalturaUrl(details.url);
      if (!parsed.entryId && !parsed.partnerId && !parsed.ks) return;
      const isManifest = /playManifest|\.m3u8(?:\?|$)/i.test(details.url);
      withState(details.tabId, (state) => merge(state, Object.assign({}, parsed, { urls: isManifest ? [details.url] : [] })))
        .catch(() => {});
    },
    { urls: ['https://*.kaltura.com/*', 'https://*.unipd.it/*'] }
  );
}

if (api.tabs && api.tabs.onRemoved) {
  api.tabs.onRemoved.addListener((tabId) => { api.storage.session.remove('t' + tabId); });
}

function first() {
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i]) return arguments[i];
  }
  return '';
}

async function startWidgetSession(partnerId) {
  try {
    const url = CDN + '/api_v3/service/session/action/startWidgetSession?widgetId=_' +
      encodeURIComponent(partnerId) + '&format=1';
    const response = await fetch(url, { credentials: 'include' });
    const data = await response.json();
    return data && data.ks ? data.ks : '';
  } catch (e) {
    return '';
  }
}

async function getFlavors(entryId, ks) {
  try {
    const url = CDN + '/api_v3/service/flavorasset/action/getByEntryId?entryId=' +
      encodeURIComponent(entryId) + '&ks=' + encodeURIComponent(ks) + '&format=1';
    const response = await fetch(url, { credentials: 'include' });
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function isUnipd(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.unipd.it');
  } catch (e) {
    return false;
  }
}

async function partnerFromPage(mediaUrl, entryId) {
  const urls = [];
  // mediaUrl comes from page content, so it must not send requests to other sites.
  if (mediaUrl && isUnipd(mediaUrl)) urls.push(mediaUrl);
  urls.push('https://mediaspace.unipd.it/media/' + encodeURIComponent(entryId));
  for (const url of urls) {
    try {
      // MediaSpace 404 pages still include the partner ID in their config.
      const response = await fetch(url, { credentials: 'include' });
      const text = await response.text();
      const match = text.match(/"partnerId"\s*:\s*(\d+)/) || text.match(/\/p\/(\d+)\//);
      if (match) return match[1];
    } catch (e) {
      // try the next URL
    }
  }
  return '';
}

async function isDownloadable(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow', credentials: 'include' });
    if (!response.ok) return false;
    const type = (response.headers.get('content-type') || '').toLowerCase();
    return type.indexOf('video/') === 0 || type === 'application/octet-stream';
  } catch (e) {
    return false;
  }
}

async function download(tabId, message) {
  const state = await withState(tabId, (s) => { merge(s, message); return s; });
  const parsedUrls = state.urls.map((url) => KV.parseKalturaUrl(url));
  const entryId = first(message.entryId, state.entryId,
    ...parsedUrls.map((item) => item.entryId));
  if (!entryId) {
    throw new Error('Video non trovato nella pagina. Apri la lezione e riprova.');
  }

  const partnerId = first(message.partnerId, state.partnerId,
    ...parsedUrls.map((item) => item.partnerId)) ||
    await partnerFromPage(first(message.mediaUrl, state.mediaUrl), entryId);
  if (!partnerId) {
    throw new Error('Impossibile identificare il corso Kaltura di questo video.');
  }

  const sessions = [];
  const addSession = (ks) => {
    if (ks && !sessions.includes(ks)) sessions.push(ks);
  };
  addSession(await startWidgetSession(partnerId));
  for (const ks of (message.ks || []).concat(state.ks)) addSession(ks);

  for (const ks of sessions) {
    const best = KV.pickBestFlavor(await getFlavors(entryId, ks));
    const candidates = [];
    if (best) candidates.push({ url: KV.buildManifestUrl(entryId, partnerId, ks, best.id), height: best.height });
    candidates.push({ url: KV.buildManifestUrl(entryId, partnerId, ks), height: 0 });

    for (const candidate of candidates) {
      if (!(await isDownloadable(candidate.url))) continue;
      const filename = KV.sanitizeFilename(first(message.title, 'video'));
      await api.downloads.download({ url: candidate.url, filename: filename });
      return { ok: true, quality: candidate.height ? candidate.height + 'p' : '' };
    }
  }

  throw new Error('Download non disponibile. Avvia il video per qualche secondo e riprova.');
}

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab && sender.tab.id;
  if (!message || !message.type || tabId === undefined || tabId === null) return;

  if (message.type === 'candidates') {
    withState(tabId, (state) => merge(state, message))
      .then(() => sendResponse({ ok: true }), () => sendResponse({ ok: false }));
    return true;
  }

  if (message.type === 'download') {
    download(tabId, message)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error.message || String(error) }));
    return true;
  }
});
