/* Shared helpers: pure functions, also exercised by test/lib.test.js. */
(function (g) {
  'use strict';

  const ENTRY_IN_URL = /\/([0-9]_[a-z0-9]{5,})(?=[/?#]|$)/i;
  const ENTRY_IN_QUERY = /[?&](?:entry_id|entryId)=([0-9]_[a-z0-9]+)/i;
  const PARTNER_IN_URL = /\/p\/(\d+)(?=[/?#]|$)/;
  const PARTNER_IN_QUERY = /[?&](?:partner_?id=|wid=_?)(\d+)/i;
  const KS_IN_PATH = /\/ks\/([^/?#]+)/;
  const KS_IN_QUERY = /[?&](?:ks|flashvars(?:%5B|\[)ks(?:%5D|\]))=([^&#]+)/i;

  function decode(value) {
    try {
      return decodeURIComponent(String(value).replace(/\+/g, ' '));
    } catch (e) {
      return String(value);
    }
  }

  function parseKalturaUrl(url) {
    const value = String(url || '');
    const result = {};
    const entry = value.match(ENTRY_IN_URL) || value.match(ENTRY_IN_QUERY);
    if (entry) result.entryId = entry[1];
    const partner = value.match(PARTNER_IN_URL) || value.match(PARTNER_IN_QUERY);
    if (partner) result.partnerId = partner[1];
    const ks = value.match(KS_IN_PATH) || value.match(KS_IN_QUERY);
    if (ks) result.ks = decode(ks[1]);
    return result;
  }

  function findKs(text) {
    const value = String(text || '');
    const found = [];
    const add = (raw) => {
      const ks = decode(String(raw).replace(/\\\//g, '/'));
      if (ks.length >= 30 && !found.includes(ks)) found.push(ks);
    };
    let match;
    const jsonRe = /"(?:ks|flashvars\.ks)"\s*:\s*"([^"]{30,})"/g;
    while ((match = jsonRe.exec(value))) add(match[1]);
    const urlRe = /(?:\/ks\/|[?&](?:ks|flashvars(?:%5B|\[)ks(?:%5D|\]))=)([^&#"'\s]{30,})/g;
    while ((match = urlRe.exec(value))) add(match[1]);
    return found;
  }

  function buildManifestUrl(entryId, partnerId, ks, flavorId) {
    let url = 'https://cdnapisec.kaltura.com/p/' + partnerId + '/sp/' + partnerId + '00' +
      '/playManifest/entryId/' + encodeURIComponent(entryId);
    if (flavorId) url += '/flavorId/' + encodeURIComponent(flavorId);
    url += '/format/url/protocol/https/a.mp4';
    if (ks) url += '/ks/' + encodeURIComponent(ks);
    return url;
  }

  function pickBestFlavor(flavors) {
    if (!Array.isArray(flavors)) return null;
    return flavors
      .filter((f) => f && Number(f.status) === 2 && f.id)
      .filter((f) => {
        const ext = String(f.fileExt || '').toLowerCase();
        return !ext || ext === 'mp4' || ext === 'mov' || ext === 'm4v';
      })
      .filter((f) => (Number(f.width) || 0) > 0 && (Number(f.height) || 0) > 0)
      .sort((a, b) => (Number(b.height) || 0) - (Number(a.height) || 0) ||
        (Number(b.width) || 0) - (Number(a.width) || 0) ||
        (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0))[0] || null;
  }

  function sanitizeFilename(name, ext) {
    const base = String(name || 'video')
      .replace(/\s*\|\s*(?:STEM|Moodle)\s*$/i, '')
      .replace(/\.(?:mp4|mov|m4v|webm)$/i, '')
      .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/^[.\s]+|[.\s]+$/g, '')
      .slice(0, 120);
    return (base || 'video') + '.' + (ext || 'mp4');
  }

  g.KV = Object.freeze({
    parseKalturaUrl: parseKalturaUrl,
    findKs: findKs,
    buildManifestUrl: buildManifestUrl,
    pickBestFlavor: pickBestFlavor,
    sanitizeFilename: sanitizeFilename,
  });
})(typeof self !== 'undefined' ? self : globalThis);
