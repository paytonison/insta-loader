// ==UserScript==
// @name         Insta Loader
// @namespace    https://github.com/paytonison/insta-loader
// @version      1.0.0
// @description  Open current media, download every item in a post, or save the current item at the best available resolution.
// @author       paytonison
// @match        https://www.instagram.com/*
// @match        https://instagram.com/*
// @run-at       document-end
// @noframes
// @grant        GM.xmlHttpRequest
// @grant        GM.openInTab
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @connect      cdninstagram.com
// @connect      fbcdn.net
// ==/UserScript==

(function () {
  'use strict';

  function parseRoute(href) {
    const url = new URL(href, 'https://www.instagram.com/');
    const parts = url.pathname.split('/').filter(Boolean);
    const story = parts[0] === 'stories' && parts[1];
    const position = ['p', 'reel', 'reels'].includes(parts[0]) ? 0 : ['p', 'reel', 'reels'].includes(parts[1]) ? 1 : -1;
    const token = story ? parts[2] || null : position >= 0 ? parts[position + 1] || null : null;
    const kind = !/^(www\.)?instagram\.com$/.test(url.hostname) || (parts[position] === 'reels' && token === 'audio') ? 'browse' : story ? 'story' : token ? 'post' : 'browse';
    const owner = story ? parts[1] : position === 1 ? parts[0] : null;
    const rawIndex = url.searchParams.get('img_index');
    const index = rawIndex && /^\d+$/.test(rawIndex) && Number.isSafeInteger(Number(rawIndex)) && Number(rawIndex) > 0 ? Number(rawIndex) : null;
    const permalink = kind === 'post' ? `https://www.instagram.com/${parts[position]}/${encodeURIComponent(token)}/` : kind === 'story' ? `https://www.instagram.com/stories/${encodeURIComponent(owner)}/${token ? `${encodeURIComponent(token)}/` : ''}` : `https://www.instagram.com${url.pathname}`;
    return { kind, token, owner, key: `${kind}:${token || (story ? owner : url.pathname)}`, index, permalink };
  }

  function cleanMediaUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value.trim().replace(/\\u0026/gi, '&').replace(/\\\//g, '/').replace(/&amp;/gi, '&'));
      const host = url.hostname.toLowerCase();
      const allowed = ['cdninstagram.com', 'fbcdn.net'].some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
      if (url.protocol !== 'https:' || !allowed || url.username || url.password || (url.port && url.port !== '443')) return null;
      if (/\.(?:mpd|m3u8?|m4s)(?:$|\/)/i.test(url.pathname)) return null;
      for (const key of url.searchParams.keys()) {
        if (/^(?:byte[_-]?(?:start|end|range)|range(?:[_-]?(?:start|end))?|start[_-]?byte|end[_-]?byte)$/i.test(key)) return null;
      }
      url.hash = '';
      return url.href;
    } catch { return null; }
  }

  function mediaKey(value) {
    const url = cleanMediaUrl(value);
    if (!url) return null;
    const parsed = new URL(url);
    return `${parsed.hostname.toLowerCase()}${parsed.pathname}`;
  }

  function positiveNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  function recordId(value) {
    return typeof value === 'string' && value ? value : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : null;
  }

  function normalizeItem(node) {
    const list = (value) => Array.isArray(value) ? value : [];
    const videos = [...list(node.video_versions), ...list(node.video_resources), ...list(node.videoResources), ...(node.video_url ? [node.video_url] : []), ...(node.videoUrl ? [node.videoUrl] : [])];
    const hasVideo = Number(node.media_type) !== 1 && (Number(node.media_type) === 2 || node.is_video === true || node.isVideo === true || /video/i.test(node.__typename || '') || videos.length > 0);
    const kind = hasVideo ? 'video' : 'image';
    const images = [...list(node.image_versions2?.candidates), ...list(node.display_resources), ...list(node.displayResources), ...(node.display_url ? [node.display_url] : []), ...(node.src ? [node.src] : [])];
    const variants = [];
    for (const value of hasVideo ? videos : images) {
      const url = cleanMediaUrl(typeof value === 'string' ? value : value?.url || value?.src);
      if (!url) continue;
      variants.push({ url, width: positiveNumber(value?.width || value?.config_width || value?.configWidth || node.original_width || node.dimensions?.width), height: positiveNumber(value?.height || value?.config_height || value?.configHeight || node.original_height || node.dimensions?.height), bitrate: positiveNumber(value?.bitrate || value?.bit_rate) });
    }
    variants.sort((a, b) => b.width * b.height - a.width * a.height || b.width - a.width || b.height - a.height || b.bitrate - a.bitrate);
    const seen = new Set();
    const unique = variants.filter(variant => { if (seen.has(variant.url)) return false; seen.add(variant.url); return true; });
    const posters = hasVideo ? [...new Set(images.map((value) => cleanMediaUrl(typeof value === 'string' ? value : value?.url || value?.src)).filter(Boolean))] : [];
    return { id: recordId(node.pk ?? node.id), kind, variants: unique, posters, hasAudio: typeof node.has_audio === 'boolean' ? node.has_audio : typeof node.hasAudio === 'boolean' ? node.hasAudio : null, duration: positiveNumber(node.video_duration ?? node.videoDuration ?? node.duration) || null };
  }

  function exactRecords(payload, route) {
    if (!route?.token || !['post', 'story'].includes(route.kind)) return [];
    const records = [];
    const visited = new WeakSet();
    const stack = [payload];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object' || visited.has(node)) continue;
      visited.add(node);
      if (Array.isArray(node)) { for (let i = node.length - 1; i >= 0; i -= 1) stack.push(node[i]); continue; }
      const ids = [recordId(node.pk), recordId(node.id)].filter(Boolean);
      const codes = [node.code, node.shortcode].filter((value) => typeof value === 'string');
      const storyId = ids.find((value) => /^\d+(?:_\d+)?$/.test(value) && value.split('_')[0] === route.token);
      const id = storyId || ids[0] || null;
      const code = codes.find((value) => value === route.token) || codes[0] || null;
      const matches = route.kind === 'post' ? codes.includes(route.token) : Boolean(storyId);
      if (matches) {
        const children = Array.isArray(node.carousel_media) ? node.carousel_media : Array.isArray(node.sidecarChildren) ? node.sidecarChildren : Array.isArray(node.edge_sidecar_to_children?.edges) ? node.edge_sidecar_to_children.edges.map((edge) => edge?.node || {}) : null;
        const isCarousel = Boolean(children?.length) || node.isSidecar === true || Number(node.media_type) === 8 || /sidecar/i.test(node.__typename || '');
        const items = (isCarousel ? children || [] : [node]).map((child) => normalizeItem(child || {}));
        const declaredCount = positiveNumber(node.carousel_media_count);
        const count = isCarousel ? Number.isSafeInteger(declaredCount) && declaredCount > 0 ? declaredCount : items.length : 1;
        const owner = typeof node.user?.username === 'string' ? node.user.username : typeof node.owner?.username === 'string' ? node.owner.username : null;
        const record = { id, code, owner, items, count, complete: count > 0 && items.length === count && items.every((item) => item.variants.length > 0) };
        // Distinct page snapshots can share an ID while one holds only a cover.
        // Keep them available for selection against the currently visible kind.
        records.push(record);
        if (isCarousel) continue;
      }
      for (const value of Object.values(node)) if (value && typeof value === 'object') stack.push(value);
    }
    return records;
  }

  function safeFilename(record, item, index, ext) {
    const safe = (value, fallback) => String(value || fallback).normalize('NFKC').replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').replace(/\.{2,}/g, '.').replace(/^[-.]+|[-.]+$/g, '').slice(0, 80) || fallback;
    const suffix = String(ext || '').replace(/^\./, '').toLowerCase();
    const extension = /^[a-z0-9]{2,5}$/.test(suffix) ? suffix : item.kind === 'video' ? 'mp4' : 'jpg';
    const ordinal = Number.isSafeInteger(index) && index > 0 ? String(index).padStart(2, '0') : '01';
    return `${safe(record.owner, 'instagram')}-${safe(record.code || record.id || item.id, 'media')}-${ordinal}.${extension}`;
  }

  function inspectMP4(buffer) {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : ArrayBuffer.isView(buffer) ? new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) : null;
    if (!bytes) throw new Error('MP4 validation requires file bytes.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const text = (offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
    function boxes(start, end) {
      const output = [];
      for (let offset = start; offset < end;) {
        if (end - offset < 8) throw new Error('The MP4 file contains a truncated box header.');
        let size = view.getUint32(offset); let header = 8;
        const type = text(offset + 4);
        if (size === 1) {
          if (end - offset < 16) throw new Error('The MP4 file contains a truncated extended header.');
          size = view.getUint32(offset + 8) * 4294967296 + view.getUint32(offset + 12); header = 16;
        } else if (size === 0) size = end - offset;
        if (!Number.isSafeInteger(size) || size < header || size > end - offset) throw new Error('The MP4 file contains a truncated or invalid box.');
        output.push({ type, start: offset + header, end: offset + size }); offset += size;
      }
      return output;
    }
    const top = boxes(0, bytes.length);
    const ftyp = top.find((box) => box.type === 'ftyp');
    const moov = top.find((box) => box.type === 'moov');
    const mdat = top.filter((box) => box.type === 'mdat');
    if (!ftyp || ftyp.end - ftyp.start < 8 || (ftyp.end - ftyp.start) % 4 || !moov || !mdat.some((box) => box.end > box.start)) throw new Error('The response is not a complete MP4 file.');
    if (top.some((box) => box.type === 'moof')) throw new Error('Fragmented MP4 media cannot be validated as a complete direct file.');
    const movieBoxes = boxes(moov.start, moov.end);
    if (movieBoxes.some((box) => box.type === 'mvex')) throw new Error('Fragmented MP4 initialization data is not a complete direct file.');
    let hasVideo = false; let hasAudio = false; let width = 0; let height = 0;
    for (const track of movieBoxes.filter((box) => box.type === 'trak')) {
      const trackBoxes = boxes(track.start, track.end);
      const mdia = trackBoxes.find((box) => box.type === 'mdia');
      if (!mdia) throw new Error('The MP4 file has an incomplete track.');
      const handler = boxes(mdia.start, mdia.end).find((box) => box.type === 'hdlr');
      if (!handler || handler.end - handler.start < 24) throw new Error('The MP4 file has an incomplete track handler.');
      const kind = text(handler.start + 8);
      if (kind === 'soun') hasAudio = true;
      if (kind !== 'vide') continue;
      hasVideo = true;
      const tkhd = trackBoxes.find((box) => box.type === 'tkhd');
      if (!tkhd) throw new Error('The MP4 video track has no dimensions.');
      const version = bytes[tkhd.start];
      const needed = version === 0 ? 84 : version === 1 ? 96 : 0;
      if (!needed || tkhd.end - tkhd.start < needed) throw new Error('The MP4 video track header is incomplete.');
      const w = view.getUint32(tkhd.start + needed - 8) / 65536;
      const h = view.getUint32(tkhd.start + needed - 4) / 65536;
      if (w * h > width * height) { width = w; height = h; }
    }
    if (!hasVideo || width <= 0 || height <= 0) throw new Error('The MP4 file has no usable video track.');
    return { hasVideo, hasAudio, width, height };
  }

  // A manager may both invoke onload and resolve its returned promise. Settle first;
  // all file/open side effects happen at the caller, once.
  function requestBytes(url, signal, manager) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let handle;
      const finish = (error, response) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(response);
      };
      const abort = () => {
        finish(new Error('Cancelled because the selected media changed.'));
        handle?.abort?.();
      };
      const timer = setTimeout(() => {
        finish(new Error('The media request timed out. Try again.'));
        handle?.abort?.();
      }, 60000);
      if (signal?.aborted) return abort();
      signal?.addEventListener('abort', abort, { once: true });
      try {
        handle = manager({
          method: 'GET', url, responseType: 'arraybuffer', timeout: 60000,
          onload: response => finish(null, response),
          onerror: error => finish(new Error(`The media request failed${error?.status ? ` (HTTP ${error.status})` : ''}${error?.error ? `: ${String(error.error).slice(0, 180)}` : '. Check Tampermonkey’s site access and content blockers.'}`)),
          ontimeout: () => finish(new Error('The media request timed out. Try again.')),
          onabort: () => finish(new Error('The media request was cancelled.')),
        });
        if (handle?.then) handle.then(r => finish(null, r), e => finish(new Error(e?.message || 'The media request failed.')));
      } catch (error) { finish(error); }
    });
  }

  function imageType(bytes) {
    const b = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 32));
    const text = String.fromCharCode(...b);
    if (b[0] === 255 && b[1] === 216 && b[2] === 255) return ['image/jpeg', 'jpg'];
    if (text.startsWith('\x89PNG\r\n\x1a\n')) return ['image/png', 'png'];
    if (text.startsWith('RIFF') && text.slice(8, 12) === 'WEBP') return ['image/webp', 'webp'];
    if (/^GIF8[79]a/.test(text)) return ['image/gif', 'gif'];
    if (text.slice(4, 8) === 'ftyp' && /avif|avis/.test(text.slice(8))) return ['image/avif', 'avif'];
    throw new Error('Instagram returned an unsupported image or an error page. Nothing was saved.');
  }

  function srcsetVariants(element) {
    const ratio = element.naturalHeight / element.naturalWidth || 1;
    const variants = [];
    for (const part of (element.srcset || '').split(',')) {
      const match = part.trim().match(/^(\S+)\s+(\d+(?:\.\d+)?)(w|x)$/);
      if (!match) continue;
      const url = cleanMediaUrl(match[1]);
      const width = match[3] === 'w' ? Number(match[2]) : Number(match[2]) * element.clientWidth;
      if (url) variants.push({ url, width, height: Math.round(width * ratio), bitrate: 0 });
    }
    const url = cleanMediaUrl(element.currentSrc || element.src);
    if (url && !variants.some(v => v.url === url)) variants.push({
      url, width: element.naturalWidth || element.videoWidth || 0,
      height: element.naturalHeight || element.videoHeight || 0, bitrate: 0,
    });
    return variants;
  }

  if (typeof module === 'object' && module.exports && typeof document === 'undefined') {
    module.exports = { parseRoute, exactRecords, cleanMediaUrl, mediaKey, safeFilename, inspectMP4, requestBytes, imageType, srcsetVariants, captureDisplayedMedia };
    return;
  }
  if (!/^(www\.)?instagram\.com$/.test(location.hostname) || window.top !== window.self) return;
  const HOST_ID = 'insta-loader-controls';
  if (document.getElementById(HOST_ID)) return;
  const gm = typeof GM === 'object' ? GM : null;
  const manager = typeof gm?.xmlHttpRequest === 'function' ? gm.xmlHttpRequest.bind(gm)
    : typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null;
  const openTab = typeof gm?.openInTab === 'function' ? gm.openInTab.bind(gm)
    : typeof GM_openInTab === 'function' ? GM_openInTab : null;
  let busy = false;
  const objectURLs = new Map();
  const lifetime = new AbortController();

  function visibleArea(element) {
    let r = element.getBoundingClientRect();
    if (r.width < 64 || r.height < 64 || element.closest('[aria-hidden="true"]')) return 0;
    let left = Math.max(0, r.left), top = Math.max(0, r.top);
    let right = Math.min(innerWidth, r.right), bottom = Math.min(innerHeight, r.bottom);
    for (let p = element; p && p !== document.documentElement; p = p.parentElement) {
      const style = getComputedStyle(p);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return 0;
      if (p !== element && /hidden|clip|scroll|auto/.test(style.overflow + style.overflowX + style.overflowY)) {
        r = p.getBoundingClientRect();
        if (/hidden|clip|scroll|auto/.test(style.overflowX)) { left = Math.max(left, r.left); right = Math.min(right, r.right); }
        if (/hidden|clip|scroll|auto/.test(style.overflowY)) { top = Math.max(top, r.top); bottom = Math.min(bottom, r.bottom); }
      }
    }
    return Math.max(0, right - left) * Math.max(0, bottom - top);
  }

  function fingerprint(element) {
    return [element.currentSrc || element.src || '', element.poster || '', element.srcset || ''].join('|');
  }

  function postRoot(element, route) {
    for (let root = element.parentElement; root && root !== document.body; root = root.parentElement) {
      const links = [...root.querySelectorAll('a[href]')].map(a => parseRoute(a.href)).filter(r => r.kind === 'post');
      const keys = new Set(links.map(r => r.key));
      if (links.length && keys.size === 1 && (route.kind !== 'post' || keys.has(route.key))) return { root, route: links[0] };
      if (root.matches('main, [role="main"]') || keys.size > 1) break;
    }
    return null;
  }

  function context() {
    const route = parseRoute(location.href);
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(d => visibleArea(d) > 0);
    const scope = dialogs.at(-1) || document;
    const elements = [...scope.querySelectorAll('video, img')]
      .filter(e => !e.closest(`#${HOST_ID}`))
      .map(element => ({ element, area: visibleArea(element) }))
      .filter(e => e.area > 20000).sort((a, b) => b.area - a.area || (a.element.tagName === 'VIDEO' ? -1 : 1));
    for (const { element } of elements) {
      // On browse screens a tile is a link to a post, not the open post itself.
      if (element.closest('a[href]') && route.kind === 'browse') continue;
      const owned = route.kind === 'story' && route.token ? { root: element.parentElement, route }
        : postRoot(element, route) || (route.kind === 'post' ? { root: element.parentElement, route } : null);
      if (!owned) continue;
      const actualRoute = route.kind === 'post' ? route : owned.route;
      const width = element.videoWidth || element.naturalWidth || 0;
      const height = element.videoHeight || element.naturalHeight || 0;
      return {
        ...owned, route: actualRoute, element, width, height,
        fingerprint: fingerprint(element), page: location.href,
        kind: element.tagName === 'VIDEO' ? 'video' : 'image',
        duration: Number.isFinite(element.duration) ? element.duration : null,
      };
    }
    throw new Error('Open a post, Reel, or Story and bring its media into view first.');
  }

  function readRecords(doc, route) {
    const records = [];
    for (const script of doc.querySelectorAll('script[type="application/json"]')) {
      const text = script.textContent || '';
      if (text.length > 12 * 1024 * 1024 || !/image_versions2|video_versions|display_resources|video_url/.test(text)) continue;
      try { records.push(...exactRecords(JSON.parse(text), route)); } catch { /* Non-media page data is not a download error. */ }
    }
    return records;
  }

  function bestRecord(records, ctx) {
    const candidates = records.filter(r => r.count > 1 || r.items[0]?.kind === ctx.kind);
    candidates.sort((a, b) => b.count - a.count || Number(b.complete) - Number(a.complete));
    const record = candidates[0];
    if (!record) return null;
    // Only combine versions with the same ordered item identities and types.
    // A thumbnail record cannot replace a full video or a carousel child.
    const versions = candidates.filter(r => r.count === record.count && r.items.length === record.items.length
      && r.items.every((item, i) => item.id && item.id.split('_')[0] === record.items[i].id?.split('_')[0] && item.kind === record.items[i].kind));
    const items = record.items.map((item, i) => ({
      ...item,
      variants: [...item.variants, ...versions.flatMap(r => r.items[i].variants)],
      posters: [...item.posters, ...versions.flatMap(r => r.items[i].posters)],
      hasAudio: versions.some(r => r.items[i].hasAudio === true) ? true : versions.some(r => r.items[i].hasAudio === false) ? false : item.hasAudio,
    }));
    return { ...record, items, complete: items.length === record.count && items.every(i => i.variants.length) };
  }

  function captureDisplayedMedia(requestId, route) {
    'use strict';
    const output = document.getElementById(requestId);
    if (!output || output.tagName !== 'SCRIPT' || output.type !== 'application/json') return;
    const publish = value => {
      const json = JSON.stringify(value);
      output.textContent = new TextEncoder().encode(json).byteLength <= 2 * 1024 * 1024
        ? json
        : JSON.stringify({ nodes: [], itemIds: [], error: 'The displayed media metadata exceeds the 2 MB read limit.' });
    };
    const fail = message => publish({ nodes: [], itemIds: [], error: message });
    try {
      if (!route || !['post', 'story'].includes(route.kind) || typeof route.token !== 'string' || !route.token) {
        fail('The current post or Story could not be identified.'); return;
      }
      const element = [...document.querySelectorAll('[data-insta-loader-read]')]
        .find(node => node.getAttribute('data-insta-loader-read') === requestId);
      if (!element) { fail('The selected media is no longer available.'); return; }
      const fiberKey = Object.getOwnPropertyNames(element).find(key => key.startsWith('__reactFiber$'));
      let fiber = fiberKey ? element[fiberKey] : null;
      if (!fiber) { fail('Instagram has not exposed the selected media data yet.'); return; }
      const own = (node, key) => Object.prototype.hasOwnProperty.call(node, key);
      const idString = value => typeof value === 'string' && value ? value
        : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : null;
      const baseId = value => {
        const id = idString(value);
        return id && /^\d+(?:_\d+)?$/.test(id) ? id.split('_')[0] : null;
      };
      const matches = node => route.kind === 'post'
        ? ['code', 'shortcode'].some(key => own(node, key) && node[key] === route.token)
        : ['id', 'pk'].some(key => own(node, key) && baseId(node[key]) === route.token);
      function resources(values, fields) {
        if (!Array.isArray(values)) return undefined;
        return values.filter(value => value && typeof value === 'object' && !Array.isArray(value)).map(value => {
          const resource = {};
          for (const field of fields) {
            if (!own(value, field)) continue;
            if (['src', 'url'].includes(field)) {
              if (typeof value[field] === 'string') resource[field] = value[field];
            } else if (typeof value[field] === 'number' && Number.isFinite(value[field])) resource[field] = value[field];
          }
          return resource;
        });
      }
      function copyNode(node, includeChildren) {
        const result = {};
        for (const key of ['id', 'pk']) {
          if (own(node, key)) { const id = idString(node[key]); if (id) result[key] = id; }
        }
        for (const key of ['code', 'shortcode', 'src', 'videoUrl']) {
          if (own(node, key) && typeof node[key] === 'string') result[key] = node[key];
        }
        for (const key of ['isVideo', 'isSidecar', 'hasAudio']) {
          if (own(node, key) && typeof node[key] === 'boolean') result[key] = node[key];
        }
        if (own(node, 'videoDuration') && typeof node.videoDuration === 'number' && Number.isFinite(node.videoDuration)) result.videoDuration = node.videoDuration;
        if (own(node, 'dimensions') && node.dimensions && typeof node.dimensions === 'object') {
          result.dimensions = {};
          for (const key of ['width', 'height']) {
            if (typeof node.dimensions[key] === 'number' && Number.isFinite(node.dimensions[key])) result.dimensions[key] = node.dimensions[key];
          }
        }
        if (own(node, 'owner') && node.owner && typeof node.owner.username === 'string') result.owner = { username: node.owner.username };
        const images = resources(node.displayResources, ['src', 'configWidth', 'configHeight']);
        const videos = resources(node.videoResources, ['src', 'url', 'width', 'height', 'configWidth', 'configHeight', 'bitrate']);
        if (images) result.displayResources = images;
        if (videos) result.videoResources = videos;
        if (includeChildren && Array.isArray(node.sidecarChildren)) {
          result.sidecarChildren = node.sidecarChildren.map(child => child && typeof child === 'object' && !Array.isArray(child) ? copyNode(child, false) : {});
        }
        return result;
      }
      const nodes = [];
      const itemIds = [];
      const seenNodes = new WeakSet();
      const seenIds = new Set();
      for (let depth = 0; fiber && depth < 60; depth += 1, fiber = fiber.return) {
        const props = fiber.memoizedProps;
        if (!props || typeof props !== 'object') continue;
        for (const key of ['post', 'media', 'story', 'storyItem']) {
          if (!own(props, key)) continue;
          const node = props[key];
          if (!node || typeof node !== 'object' || Array.isArray(node)) continue;
          const id = baseId(own(node, 'id') ? node.id : null) || baseId(own(node, 'pk') ? node.pk : null);
          if (id && !seenIds.has(id)) { seenIds.add(id); itemIds.push(id); }
          if (matches(node) && !seenNodes.has(node)) { seenNodes.add(node); nodes.push(copyNode(node, true)); }
        }
      }
      publish(nodes.length ? { nodes, itemIds } : { nodes: [], itemIds, error: 'The displayed data does not identify this exact post or Story.' });
    } catch {
      fail('The selected media metadata could not be read. Let it finish loading and try again.');
    }
  }

  function displayedRecords(ctx) {
    const requestId = `${HOST_ID}-read-${Date.now().toString(36)}`;
    const output = document.createElement('script');
    output.id = requestId; output.type = 'application/json';
    const reader = document.createElement('script');
    reader.nonce = document.querySelector('script[nonce]')?.nonce || '';
    reader.textContent = `(${captureDisplayedMedia.toString()})(${JSON.stringify(requestId)},${JSON.stringify(ctx.route)})`;
    ctx.element.setAttribute('data-insta-loader-read', requestId);
    try {
      document.documentElement.append(output, reader);
      if (!output.textContent) {
        ctx.readError = 'Safari could not read this post’s loaded media data. Reload the post and try again.';
        return [];
      }
      const result = JSON.parse(output.textContent);
      ctx.itemIds = result.itemIds || [];
      ctx.readError = result.error;
      return exactRecords(result.nodes, ctx.route);
    } finally {
      ctx.element.removeAttribute('data-insta-loader-read');
      output.remove(); reader.remove();
    }
  }

  function resolveRecord(ctx, signal) {
    const record = bestRecord([...displayedRecords(ctx), ...readRecords(document, ctx.route)], ctx);
    assertCurrent(ctx, signal);
    if (!record) throw new Error(ctx.readError || 'Instagram has not exposed a complete file for this item. Let it load, then try again.');
    return record;
  }

  function currentIndex(record, ctx) {
    for (const id of ctx.itemIds || []) {
      const index = record.items.findIndex(item => item.id?.split('_')[0] === id && item.kind === ctx.kind);
      if (index >= 0) return index;
    }
    const displayed = [ctx.element.currentSrc, ctx.element.src, ctx.element.poster]
      .map(mediaKey).filter(Boolean);
    const matches = record.items.map((item, index) => ({ item, index })).filter(({ item }) =>
      item.kind === ctx.kind && [...item.variants.map(v => v.url), ...item.posters].some(url => displayed.includes(mediaKey(url))));
    if (matches.length === 1) return matches[0].index;
    if (record.count === 1 && record.items.length === 1 && record.items[0].kind === ctx.kind) return 0;
    throw new Error('The current carousel item could not be identified. Open the item’s permalink or let its image finish loading.');
  }

  function assertCurrent(ctx, signal, checkItem = true) {
    if (signal.aborted || location.href !== ctx.page || !ctx.element.isConnected
      || (checkItem && fingerprint(ctx.element) !== ctx.fingerprint)) {
      throw new Error('The selected media changed. Click the action again for the new item.');
    }
  }

  function releaseURL(url) {
    clearTimeout(objectURLs.get(url)); objectURLs.delete(url); URL.revokeObjectURL(url);
  }

  function temporaryURL(blob) {
    const url = URL.createObjectURL(blob);
    objectURLs.set(url, setTimeout(() => releaseURL(url), 60000));
    return url;
  }

  async function validateBytes(bytes, item, variant, signal) {
    if (!bytes || typeof bytes.byteLength !== 'number' || !bytes.byteLength) throw new Error('Instagram returned an empty media file.');
    if (bytes.byteLength > 512 * 1024 * 1024) throw new Error('This file exceeds the downloader’s 512 MB memory limit.');
    if (item.kind === 'video') {
      const info = inspectMP4(bytes);
      if (!info.hasAudio && item.hasAudio !== false) throw new Error('This video file has no audio track; Instagram has not confirmed this is a silent video.');
      if (variant.width && variant.height && info.width * info.height < variant.width * variant.height) {
        throw new Error('The video file is smaller than the rendition Instagram advertised.');
      }
      return { blob: new Blob([bytes], { type: 'video/mp4' }), ext: 'mp4', ...info };
    }
    const [type, ext] = imageType(bytes);
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        const done = error => {
          clearTimeout(timer); signal.removeEventListener('abort', abort);
          img.onload = img.onerror = null;
          if (error) { img.src = ''; reject(error); } else resolve();
        };
        const abort = () => done(new Error('The image request was cancelled.'));
        const timer = setTimeout(() => done(new Error('The downloaded image did not decode.')), 10000);
        img.onload = () => done(); img.onerror = () => done(new Error('The downloaded image is not readable.'));
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) return abort();
        img.src = url;
      });
      if (variant.width && img.naturalWidth < variant.width) throw new Error('The image file is smaller than the rendition Instagram advertised.');
      return { blob, ext, width: img.naturalWidth, height: img.naturalHeight };
    } finally { URL.revokeObjectURL(url); }
  }

  async function prepareItem(item, ctx, index, selectedIndex, signal) {
    let variants = [...item.variants];
    const displayedURLs = [ctx.element.currentSrc, ctx.element.src, ctx.element.poster].map(mediaKey).filter(Boolean);
    const ownsElement = (ctx.itemIds || []).includes(item.id?.split('_')[0])
      || [...item.variants.map(v => v.url), ...item.posters].some(url => displayedURLs.includes(mediaKey(url)));
    if (index === selectedIndex && ctx.kind === item.kind && ownsElement) variants.push(...srcsetVariants(ctx.element));
    variants.sort((a, b) => b.width * b.height - a.width * a.height || b.bitrate - a.bitrate);
    variants = variants.filter((v, i) => variants.findIndex(other => other.url === v.url) === i);
    if (!variants.length) throw new Error(`Item ${index + 1}: Instagram has exposed only a preview or a streaming source, not a complete file.`);
    const pixels = variants[0].width * variants[0].height;
    const bitrate = variants[0].bitrate;
    // Mirrors at the same resolution can differ in availability/audio. Never
    // silently drop to a smaller image or video after a failed request.
    let reason = '';
    for (const variant of variants.filter(v => v.width * v.height === pixels && v.bitrate === bitrate).slice(0, 4)) {
      assertCurrent(ctx, signal);
      try {
        if (!manager) throw new Error('Enable this script in Tampermonkey and allow its media requests.');
        const response = await requestBytes(variant.url, signal, manager);
        assertCurrent(ctx, signal);
        if (response.status !== 200 || /(?:^|\n)content-range:/i.test(response.responseHeaders || '')) {
          throw new Error(`The media server returned HTTP ${response.status || 'error'} instead of a complete file.`);
        }
        if (response.finalUrl && !cleanMediaUrl(response.finalUrl)) throw new Error('The media request redirected away from Instagram’s CDN.');
        const result = await validateBytes(response.response, item, variant, signal);
        assertCurrent(ctx, signal);
        return { ...result, source: variant.url };
      } catch (error) {
        if (signal.aborted) throw error;
        reason = error.message;
      }
    }
    throw new Error(`Item ${index + 1}: ${reason} A lower-resolution file was not substituted.`);
  }

  let jobController = null;
  function mount() {
    if (document.getElementById(HOST_ID)) return;
    const host = document.createElement('div'); host.id = HOST_ID;
    host.style.cssText = 'all:initial!important;position:fixed!important;bottom:76px!important;right:16px!important;z-index:2147483647!important;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>
      :host{color-scheme:light dark}*{box-sizing:border-box}.panel{font:13px -apple-system,BlinkMacSystemFont,sans-serif;color:#fff;background:#18181b;border:1px solid #555;border-radius:14px;box-shadow:0 5px 22px #0005;padding:6px;max-width:calc(100vw - 32px)}
      .buttons{display:flex;gap:3px}button{font:inherit;display:flex;align-items:center;gap:6px;cursor:pointer;color:#fff;background:transparent;border:0;border-radius:9px;padding:10px;white-space:nowrap}button:hover{background:#39393f}button:focus-visible{outline:2px solid #c4b5fd;outline-offset:-2px}button:disabled{opacity:.5;cursor:wait}button:last-child{background:#6d28d9}button:last-child:hover{background:#7c3aed}svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.status{display:none;max-width:340px;margin:6px 5px 4px;line-height:1.45;overflow-wrap:anywhere}.status:not(:empty){display:block}.status[data-error=true]{color:#fca5a5}@media(max-width:420px){button{padding:9px 7px;font-size:12px}}
    </style><div class="panel"><div class="buttons" role="toolbar" aria-label="Instagram media">
      <button type="button" data-action="open" title="Open the current media file in a new tab" aria-label="Open current media in new tab"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3h7v7M10 14 21 3M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/></svg>Open</button>
      <button type="button" data-action="all" title="Download every media item in this post, in order" aria-label="Download all media in post"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V4h12M8 8h12v13H8ZM14 10v8m-3-3 3 3 3-3"/></svg>Download all</button>
      <button type="button" data-action="download" title="Download the current item at the best available resolution" aria-label="Download current media"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></svg>Download</button>
    </div><div class="status" role="status" aria-live="polite"></div></div>`;
    const buttons = [...shadow.querySelectorAll('button')];
    const status = shadow.querySelector('.status');
    const say = (text, error = false) => { status.textContent = text; status.dataset.error = String(error); };
    shadow.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button || busy) return;
      busy = true; buttons.forEach(b => { b.disabled = true; });
      jobController = new AbortController();
      const { signal } = jobController;
      let watch;
      let started = 0;
      try {
        const ctx = context();
        watch = setInterval(() => {
          if (location.href !== ctx.page || !ctx.element.isConnected || fingerprint(ctx.element) !== ctx.fingerprint) jobController?.abort();
        }, 250);
        say('Finding this post’s best available media…');
        const record = await resolveRecord(ctx, signal);
        const all = button.dataset.action === 'all';
        let selectedIndex = -1;
        try { selectedIndex = currentIndex(record, ctx); } catch (error) { if (!all) throw error; }
        const indexes = all ? record.items.map((_, i) => i) : [selectedIndex];
        if (all && (!record.complete || record.count !== record.items.length || record.items.some(i => !i.variants.length))) {
          throw new Error('Instagram has not exposed every item in this post. No bulk download was started. Reload the post and try again.');
        }
        for (const index of indexes) {
          say(`Checking ${all ? `item ${index + 1} of ${record.count}` : 'current media'}…`);
          const prepared = await prepareItem(record.items[index], ctx, index, selectedIndex, signal);
          const filename = safeFilename(record, record.items[index], index + 1, prepared.ext);
          assertCurrent(ctx, signal);
          if (button.dataset.action === 'open') {
            if (!openTab) throw new Error('The userscript manager’s open-tab permission is unavailable.');
            await openTab(prepared.source, { active: true, insert: true, setParent: true });
            say(`Opened ${prepared.width} × ${prepared.height}${prepared.hasAudio ? ' · audio included' : ''}.`);
          } else {
            const link = document.createElement('a');
            link.href = temporaryURL(prepared.blob); link.download = filename;
            link.style.display = 'none'; document.documentElement.append(link);
            link.click(); link.remove(); started++;
            say(`Sent ${started}${all ? ` of ${record.count}` : ''} to Safari Downloads · ${prepared.width} × ${prepared.height}${prepared.hasAudio ? ' · audio included' : ''}.`);
          }
        }
      } catch (error) {
        say(`${started ? `${started} file(s) sent to Safari before stopping. ` : ''}${signal.aborted ? 'The action was cancelled or timed out. Keep the item open and try again.' : error.message}`, true);
      } finally {
        clearInterval(watch); jobController = null;
        busy = false; buttons.forEach(b => { b.disabled = false; });
      }
    }, { signal: lifetime.signal });
    document.documentElement.append(host);
  }
  addEventListener('pagehide', () => {
    jobController?.abort();
    for (const url of objectURLs.keys()) releaseURL(url);
  }, { signal: lifetime.signal });
  if (document.documentElement) mount();
  else document.addEventListener('DOMContentLoaded', mount, { once: true, signal: lifetime.signal });
})();
