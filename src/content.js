/* Adds a download button under the kalvidres player on Moodle. */
(function () {
  'use strict';

  const api = globalThis.browser || globalThis.chrome;
  if (window.top !== window || !/\/mod\/kalvidres\/view\.php$/.test(location.pathname)) return;
  if (!api || !api.runtime || !api.runtime.sendMessage) return;

  function collect() {
    const urls = [];
    let text = '';

    const add = (raw) => {
      if (!raw) return;
      let url;
      try {
        url = new URL(raw, location.href).href;
      } catch (e) {
        return;
      }
      if (!/(mediaspace|kaltura|playManifest|\.m3u8(?:\?|$)|entry_?id|\/p\/\d+\/|\/(?:0|1)_[a-z0-9]{5,})/i.test(url)) return;
      if (!urls.includes(url)) urls.push(url);
    };

    const scan = (doc) => {
      doc.querySelectorAll('iframe[src], video[src], source[src], a[href]').forEach((el) => {
        add(el.src || el.href);
      });
      doc.querySelectorAll('script:not([src])').forEach((el) => {
        if (text.length < 1000000) text += el.textContent + '\n';
      });
    };

    scan(document);
    document.querySelectorAll('iframe').forEach((frame) => {
      add(frame.src);
      try {
        const doc = frame.contentDocument;
        if (!doc) return;
        add(doc.location.href);
        scan(doc);
      } catch (e) {
        // cross-origin player frame; webRequest captures its manifest instead
      }
    });

    const parsed = urls.map((url) => KV.parseKalturaUrl(url));
    const entry = parsed.find((item) => item.entryId);
    const partner = parsed.find((item) => item.partnerId);
    const entryFromText = (text.match(/entry_?id["']?\s*[:=]\s*["']?([0-9]_[a-z0-9]{5,})/i) || [])[1];
    const partnerFromText = (text.match(/partner_?id["']?\s*[:=]\s*["']?(\d+)/i) || [])[1];
    const mediaUrl = urls.find((url) => /\/media\//.test(url) && !/\.(?:js|css|png|jpe?g|gif|svg|woff2?)(?:\?|$)/i.test(url));

    return {
      urls: urls.slice(0, 60),
      ks: KV.findKs(text + '\n' + urls.join('\n')).slice(0, 5),
      entryId: entry ? entry.entryId : (entryFromText || ''),
      partnerId: partner ? partner.partnerId : (partnerFromText || ''),
      mediaUrl: mediaUrl || '',
    };
  }

  function mount() {
    if (document.getElementById('kv-download-bar')) return true;

    let anchor = document.querySelector('.kalvidres-layout');
    if (!anchor) {
      const player = document.querySelector('.kaltura-player-container') || document.querySelector('#contentframe');
      anchor = player ? (player.closest('.kalvidres-video-main') || player.parentElement) : null;
    }
    if (!anchor) return false;

    const bar = document.createElement('div');
    bar.id = 'kv-download-bar';

    const button = document.createElement('button');
    button.id = 'kv-download-btn';
    button.type = 'button';
    button.textContent = 'Scarica video';

    const status = document.createElement('span');
    status.id = 'kv-download-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    bar.appendChild(button);
    bar.appendChild(status);
    anchor.insertAdjacentElement('afterend', bar);

    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = 'Preparazione…';
      try {
        const data = collect();
        const result = await api.runtime.sendMessage(Object.assign({ type: 'download', title: document.title }, data));
        if (!result || !result.ok) throw new Error((result && result.error) || 'Errore sconosciuto');
        status.textContent = result.quality ? 'Download avviato (' + result.quality + ')' : 'Download avviato';
      } catch (error) {
        status.textContent = error.message || String(error);
      } finally {
        setTimeout(() => { button.disabled = false; }, 1500);
      }
    });

    return true;
  }

  const sendCandidates = () => {
    try {
      const request = api.runtime.sendMessage(Object.assign({ type: 'candidates' }, collect()));
      if (request && request.catch) request.catch(() => {});
    } catch (e) {
      // extension reloaded/disabled
    }
  };

  sendCandidates();
  setTimeout(sendCandidates, 1500);
  setTimeout(sendCandidates, 5000);

  if (!mount()) {
    const observer = new MutationObserver(() => {
      if (mount()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 30000); // no player on this page: stop watching
  }
})();
