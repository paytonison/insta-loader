'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const core = require('../insta-loader.user.js');
const cdn = 'https://scontent.cdninstagram.com';
const image = (id, code, width = 1080) => ({ pk: id, code, media_type: 1, image_versions2: { candidates: [{url: `${cdn}/${id}.jpg?oh=signed&stp=full`, width, height: width}] } });
const route = core.parseRoute('https://www.instagram.com/p/POST/');

test('routes preserve exact identity and one-based index', () => {
  for (const path of ['/p/POST/', '/reel/POST/', '/reels/POST/', '/someone/p/POST/', '/someone/reel/POST/']) {
    const r = core.parseRoute(`https://www.instagram.com${path}?img_index=2`);
    assert.equal(r.kind, 'post'); assert.equal(r.token, 'POST'); assert.equal(r.index, 2);
  }
  assert.equal(core.parseRoute('https://www.instagram.com/p/POST/?img_index=-1').index, null);
  assert.equal(core.parseRoute('https://www.instagram.com/').token, null);
  assert.deepEqual(core.parseRoute('/stories/person/1234/'), {kind:'story',token:'1234',owner:'person',key:'story:1234',index:null,permalink:'https://www.instagram.com/stories/person/1234/'});
});

test('URL validation retains signing and rejects credentials, foreign hosts, ranges and manifests', () => {
  assert.equal(core.cleanMediaUrl(`${cdn}/a.jpg?oh=signed&oe=xyz`), `${cdn}/a.jpg?oh=signed&oe=xyz`);
  assert.equal(core.cleanMediaUrl('https://x.fbcdn.net/a.mp4?x=1'), 'https://x.fbcdn.net/a.mp4?x=1');
  for (const value of ['http://scontent.cdninstagram.com/a.jpg', 'https://scontent.cdninstagram.com.evil.test/a.jpg', 'https://user:secret@scontent.cdninstagram.com/a.jpg', 'https://x.fbcdn.net/a.mpd', 'https://x.fbcdn.net/a.m4s', 'https://x.fbcdn.net/a.mp4?bytestart=0', 'https://x.fbcdn.net/a.mp4?byte_end=99', 'https://x.fbcdn.net/a.mp4?range=0-99', 'blob:https://www.instagram.com/123']) assert.equal(core.cleanMediaUrl(value), null, value);
  assert.equal(core.mediaKey(`${cdn}/a.jpg?oh=one`), core.mediaKey(`${cdn}/a.jpg?oh=two`));
});

test('records never acquire identity from current route, parent or freshness', () => {
  assert.deepEqual(core.exactRecords({recommended:image('1','OTHER'), unowned:image('2',undefined)}, route), []);
  assert.deepEqual(core.exactRecords({code:'POST', nested:image('3',undefined)}, route)[0].items[0].variants, []);
  assert.equal(core.exactRecords({items:[image('1','OTHER'),image('2','POST')]}, route)[0].id, '2');
});

test('Story records match their own id base only', () => {
  const storyRoute = core.parseRoute('/stories/person/22/');
  const result = core.exactRecords({items:[image('11_999',undefined),image('22_999',undefined)]}, storyRoute);
  assert.equal(result.length, 1); assert.equal(result[0].id, '22_999');
  assert.deepEqual(core.exactRecords({code:'22',items:[image('11',undefined)]}, storyRoute), []);
});

test('mixed carousel preserves supplied order and missing-video placeholder without using its poster', () => {
  const payload = {pk:'parent',code:'POST',user:{username:'artist'},media_type:8,carousel_media_count:3,carousel_media:[image('first'),{pk:'middle',media_type:2,image_versions2:{candidates:[{url:`${cdn}/poster.jpg`}]},has_audio:true},image('last')]};
  const [record] = core.exactRecords(payload, route);
  assert.deepEqual(record.items.map((item) => item.id), ['first','middle','last']);
  assert.equal(record.count, 3); assert.equal(record.complete, false);
  assert.equal(record.items[1].kind, 'video'); assert.deepEqual(record.items[1].variants, []);
  assert.deepEqual(record.items[1].posters, [`${cdn}/poster.jpg`]); assert.equal(record.items[1].hasAudio,true);
  payload.carousel_media = payload.carousel_media.slice(0,1);
  assert.equal(core.exactRecords(payload,route)[0].count,3); assert.equal(core.exactRecords(payload,route)[0].items.length,1);
});

test('variants rank resolution before bitrate and preserve explicit silent-video metadata', () => {
  const [record] = core.exactRecords({pk:'v',code:'POST',media_type:2,has_audio:false,video_duration:3.4,video_versions:[{url:`${cdn}/small.mp4`,width:720,height:1280,bitrate:999999999},{url:`${cdn}/large.mp4`,width:1080,height:1920,bitrate:100}]},route);
  assert.equal(record.items[0].variants[0].width,1080); assert.equal(record.items[0].hasAudio,false); assert.equal(record.items[0].duration,3.4); assert.equal(record.complete,true);
});

test('malformed payload arrays cannot crash extraction; filenames are stable and safe', () => {
  const [record] = core.exactRecords({pk:'x',code:'POST',media_type:2,video_versions:{url:'not-an-array'}},route);
  assert.equal(record.complete,false);
  assert.equal(core.safeFilename({owner:'a/b',code:'POST'},{id:'x',kind:'video'},2,'.mp4'),'a-b-POST-02.mp4');
});

function box(type, ...parts) { const payload=Buffer.concat(parts);const out=Buffer.alloc(8+payload.length);out.writeUInt32BE(out.length);out.write(type,4,'ascii');payload.copy(out,8);return out; }
function track(kind,width=0,height=0,version=0) {
  const tkhd=Buffer.alloc(version===1?96:84);tkhd[0]=version;tkhd.writeUInt32BE(width*65536,tkhd.length-8);tkhd.writeUInt32BE(height*65536,tkhd.length-4);
  const hdlr=Buffer.alloc(24);hdlr.write(kind,8,'ascii');return box('trak',box('tkhd',tkhd),box('mdia',box('hdlr',hdlr)));
}
function file(audio=true,version=0) { return Buffer.concat([box('ftyp',Buffer.from('isom\0\0\0\0isom')),box('moov',track('vide',1080,1920,version),...(audio?[track('soun')]:[])),box('mdat',Buffer.alloc(32))]); }

test('MP4 inspection identifies video dimensions and audio track for v0/v1 headers', () => {
  assert.deepEqual(core.inspectMP4(file()),{hasVideo:true,hasAudio:true,width:1080,height:1920});
  assert.deepEqual(core.inspectMP4(file(false,1)),{hasVideo:true,hasAudio:false,width:1080,height:1920});
});

test('MP4 rejects truncated boxes, missing media and fragmented initialization or segments', () => {
  const complete=file();assert.throws(()=>core.inspectMP4(complete.subarray(0,-1)),/truncated/);
  assert.throws(()=>core.inspectMP4(complete.subarray(0,4)),/truncated/);
  assert.throws(()=>core.inspectMP4(box('mdat',Buffer.alloc(20))),/complete/);
  assert.throws(()=>core.inspectMP4(Buffer.concat([complete,box('moof')])) ,/Fragmented/);
  assert.throws(()=>core.inspectMP4(Buffer.concat([box('ftyp',Buffer.from('isom\0\0\0\0')),box('moov',box('mvex')),box('mdat',Buffer.alloc(8))])),/Fragmented/);
  const noVideo=Buffer.concat([box('ftyp',Buffer.from('isom\0\0\0\0')),box('moov',track('soun')),box('mdat',Buffer.alloc(8))]);
  assert.throws(()=>core.inspectMP4(noVideo),/no usable video/);
});

test('MP4 supports correctly sized extended boxes and rejects malformed nested sizes', () => {
  const tail=Buffer.alloc(24);tail.writeUInt32BE(1);tail.write('free',4);tail.writeUInt32BE(24,12);
  assert.equal(core.inspectMP4(Buffer.concat([file(),tail])).hasAudio,true);
  const corrupt=file();const at=corrupt.indexOf(Buffer.from('hdlr'));corrupt.writeUInt32BE(999999,at-4);
  assert.throws(()=>core.inspectMP4(corrupt),/truncated or invalid/);
});

test('empty video variants do not turn a photo into a video and unsafe numeric ids are not trusted', () => {
  const photo = image('safe','POST'); photo.video_versions = [];
  assert.equal(core.exactRecords(photo,route)[0].items[0].kind,'image');
  assert.deepEqual(core.exactRecords({id:9007199254740993,video_url:`${cdn}/x.mp4`},core.parseRoute('/stories/person/9007199254740992/')),[]);
});

test('an image-only thumbnail cannot discard a later full video with the same id', () => {
  const records = core.exactRecords([image('same','POST'), {pk:'same',code:'POST',media_type:2,has_audio:true,video_versions:[{url:`${cdn}/full.mp4`,width:1080,height:1920}]}],route);
  assert.equal(records.length,2);
  assert.deepEqual(records.map(record => record.items[0].kind),['image','video']);
  assert.equal(records[1].items[0].variants[0].url,`${cdn}/full.mp4`);
  assert.equal(records[1].complete,true);
});

test('normalizes the observed displayed-component carousel with exact ordered children', () => {
  const parent = {id:'3978873996351670898',code:'Dc3zNGWlIpy',isSidecar:true,owner:{username:'nasa'},sidecarChildren:[
    {id:'first',carouselParentId:'3978873996351670898',isVideo:false,dimensions:{width:1158,height:1544},displayResources:[{configWidth:640,configHeight:853,src:`${cdn}/first-small.jpg`},{configWidth:1158,configHeight:1544,src:`${cdn}/first-large.jpg`}],src:`${cdn}/first-small.jpg`},
    {id:'second',carouselParentId:'3978873996351670898',isVideo:true,dimensions:{width:720,height:1280},videoResources:[{configWidth:720,configHeight:1280,src:`${cdn}/second.mp4`}],videoUrl:`${cdn}/second.mp4`,displayResources:[{configWidth:720,configHeight:1280,src:`${cdn}/second-poster.jpg`}],hasAudio:true}
  ]};
  const [record] = core.exactRecords({post:parent,media:parent.sidecarChildren[0]},core.parseRoute('/p/Dc3zNGWlIpy/'));
  assert.equal(record.id,parent.id);assert.equal(record.count,2);assert.equal(record.complete,true);
  assert.deepEqual(record.items.map(item=>item.id),['first','second']);
  assert.deepEqual(record.items.map(item=>item.kind),['image','video']);
  assert.equal(record.items[0].variants[0].width,1158);assert.equal(record.items[0].variants[0].height,1544);
  assert.equal(record.items[1].variants[0].url,`${cdn}/second.mp4`);assert.equal(record.items[1].variants.length,1);
  assert.deepEqual(record.items[1].posters,[`${cdn}/second-poster.jpg`]);assert.equal(record.items[1].hasAudio,true);
});

test('displayed component records accept only the exact parent and its owned source list', () => {
  const parent = {id:'parent',code:'POST',isSidecar:true,sidecarChildren:[{id:'child',carouselParentId:'parent',isVideo:false,displayResources:[{configWidth:1080,configHeight:1350,src:`${cdn}/owned.jpg`}]}]};
  const neighbor = {id:'neighbor',code:'OTHER',isVideo:false,src:`${cdn}/unrelated.jpg`};
  const strayChild = {id:'stray',carouselParentId:'unrelated-parent',isVideo:false,src:`${cdn}/stray.jpg`};
  const records = core.exactRecords({post:parent,nearbyPost:neighbor,media:strayChild},route);
  assert.equal(records.length,1);assert.deepEqual(records[0].items.flatMap(item=>item.variants.map(v=>v.url)),[`${cdn}/owned.jpg`]);
  assert.deepEqual(core.exactRecords(strayChild,route),[]);
});

test('duplicate rendition URLs retain their strongest dimension metadata before ranking', () => {
  const [record] = core.exactRecords({id:'duplicate',code:'POST',isVideo:false,displayResources:[
    {src:`${cdn}/high.jpg`,configWidth:320,configHeight:320},
    {src:`${cdn}/medium.jpg`,configWidth:720,configHeight:720},
    {src:`${cdn}/high.jpg`,configWidth:1080,configHeight:1080}
  ]},route);
  assert.equal(record.items[0].variants.length,2);assert.equal(record.items[0].variants[0].url,`${cdn}/high.jpg`);assert.equal(record.items[0].variants[0].width,1080);
});

test('standalone component video preserves camelCase audio and duration without using its poster', () => {
  const [record] = core.exactRecords({id:'video',code:'POST',isVideo:true,videoUrl:`${cdn}/video.mp4`,src:`${cdn}/poster.jpg`,dimensions:{width:720,height:1280},hasAudio:false,videoDuration:28.4},route);
  assert.equal(record.items[0].kind,'video');assert.equal(record.items[0].hasAudio,false);assert.equal(record.items[0].duration,28.4);
  assert.deepEqual(record.items[0].variants.map(v=>v.url),[`${cdn}/video.mp4`]);assert.deepEqual(record.items[0].posters,[`${cdn}/poster.jpg`]);
});

// Transport tests use a deterministic timer and signal so cancellation is checked
// without a real network request or waiting for the production deadline.
function transportHarness(t) {
  const timers = new Map();
  let nextTimer = 0;
  t.mock.method(globalThis, 'setTimeout', callback => { const id = ++nextTimer; timers.set(id, callback); return id; });
  t.mock.method(globalThis, 'clearTimeout', id => timers.delete(id));
  const listeners = new Set();
  const signal = {
    aborted: false,
    addEventListener(type, listener) { if (type === 'abort') listeners.add(listener); },
    removeEventListener(type, listener) { if (type === 'abort') listeners.delete(listener); },
    abort() { this.aborted = true; for (const listener of [...listeners]) listener(); },
  };
  return { timers, signal, listeners };
}

test('request transport accepts dual callback and promise completion only once', async t => {
  const h = transportHarness(t);
  const url = `${cdn}/clip.mp4?oh=sig%2B%2F%3D&oe=abcdef&stp=full`;
  const first = {status:200,response:Uint8Array.of(1,2,3).buffer};
  let calls = 0;
  let completed = 0;
  let options;
  const result = await core.requestBytes(url,h.signal,details => {
    calls += 1; options = details;
    details.onload(first);
    return Promise.resolve({status:200,response:Uint8Array.of(4).buffer});
  }).then(response => { completed += 1; return response; });
  assert.equal(result,first); assert.equal(calls,1); assert.equal(completed,1);
  assert.equal(options.url,url); assert.equal(options.responseType,'arraybuffer');
  assert.equal(h.timers.size,0); assert.equal(h.listeners.size,0);
  options.onerror(); options.onload({status:500});
  await Promise.resolve(); assert.equal(completed,1);
});

test('request timeout rejects, aborts the manager handle and cleans up', async t => {
  const h = transportHarness(t);
  let aborted = 0;
  let options;
  const pending = core.requestBytes(`${cdn}/clip.mp4`,h.signal,details => {
    options = details; return {abort() { aborted += 1; details.onabort(); }};
  });
  const failure = assert.rejects(pending,/timed out/i);
  assert.equal(h.timers.size,1); assert.equal(h.listeners.size,1);
  [...h.timers.values()][0]();
  await failure;
  assert.equal(aborted,1); assert.equal(h.timers.size,0); assert.equal(h.listeners.size,0);
  options.onload({status:200,response:new ArrayBuffer(10)});
});

test('selection abort rejects, aborts the manager handle and cleans up', async t => {
  const h = transportHarness(t);
  let aborted = 0;
  const pending = core.requestBytes(`${cdn}/clip.mp4`,h.signal,details => ({abort() { aborted += 1; details.onabort(); }}));
  const failure = assert.rejects(pending,/cancelled/i);
  h.signal.abort(); await failure;
  assert.equal(aborted,1); assert.equal(h.timers.size,0); assert.equal(h.listeners.size,0);
});

test('already-cancelled requests never call the manager or retain resources', async t => {
  const h = transportHarness(t); h.signal.aborted = true;
  let called = false;
  await assert.rejects(core.requestBytes(`${cdn}/clip.mp4`,h.signal,() => { called = true; }),/cancelled/i);
  assert.equal(called,false); assert.equal(h.timers.size,0); assert.equal(h.listeners.size,0);
});

test('manager throw and rejected promise both propagate with resource cleanup', async t => {
  const h = transportHarness(t);
  await assert.rejects(core.requestBytes(`${cdn}/clip.mp4`,h.signal,() => { throw new Error('permission denied'); }),/permission denied/);
  assert.equal(h.timers.size,0); assert.equal(h.listeners.size,0);
  await assert.rejects(core.requestBytes(`${cdn}/clip.mp4`,h.signal,() => Promise.reject(new Error('network failed'))),/network failed/);
  assert.equal(h.timers.size,0); assert.equal(h.listeners.size,0);
});

test('srcset variants preserve full signed URL queries and suppress duplicate current source', () => {
  const small = `${cdn}/photo.jpg?oh=small%2B%2F%3D&oe=one&stp=s320x320`;
  const large = `${cdn}/photo.jpg?oh=large%2B%2F%3D&oe=two&stp=s1080x1080`;
  const element = {srcset:`${small} 320w, ${large} 1080w`,currentSrc:large,src:small,naturalWidth:1080,naturalHeight:1350,clientWidth:540};
  const variants = core.srcsetVariants(element);
  assert.deepEqual(variants.map(value => value.url),[small,large]);
  assert.deepEqual(variants.map(value => [value.width,value.height]),[[320,400],[1080,1350]]);
  const density = core.srcsetVariants({...element,srcset:`${large} 2x`,currentSrc:large});
  assert.equal(density.length,1); assert.equal(density[0].width,1080);
  assert.deepEqual(core.srcsetVariants({src:'blob:https://www.instagram.com/local',srcset:'https://other.example/a.jpg 1080w'}),[]);
});

test('image sniffing recognizes genuine JPEG and PNG bytes and rejects HTML responses', () => {
  const arrayBuffer = base64 => { const b = Buffer.from(base64,'base64');return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength); };
  const jpeg = arrayBuffer('/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjAuMTAwAP/bAEMACAQEBAQEBQUFBQUFBgYGBgYGBgYGBgYGBgcHBwgICAcHBwYGBwcICAgICQkJCAgICAkJCgoKDAwLCw4ODhERFP/EAEsAAQEAAAAAAAAAAAAAAAAAAAAIAQEAAAAAAAAAAAAAAAAAAAAAEAEAAAAAAAAAAAAAAAAAAAAAEQEAAAAAAAAAAAAAAAAAAAAA/8AAEQgAAgACAwEiAAIRAAMRAP/aAAwDAQACEQMRAD8An8AH/9k=');
  const png = arrayBuffer('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAABAAAAAQBPJcTWAAAADklEQVR4nGNkAAMWCAUAADgABkRoBWYAAAAASUVORK5CYII=');
  assert.deepEqual(core.imageType(jpeg),['image/jpeg','jpg']);
  assert.deepEqual(core.imageType(png),['image/png','png']);
  assert.throws(() => core.imageType(new TextEncoder().encode('<!doctype html><html>Login required</html>').buffer),/unsupported image|error page/i);
  assert.throws(() => core.imageType(new ArrayBuffer(0)),/unsupported image|error page/i);
});

// Exercise the shipped script against a small DOM, including its actual page-context
// reader. Transport intentionally fails after recording the selected file URL.
function toolbarPage(href = 'https://www.instagram.com/') {
  const vm = require('node:vm');
  const source = fs.readFileSync(require.resolve('../insta-loader.user.js'), 'utf8');
  const events = [];
  const frames = new Map();
  const observers = [];
  const requests = [];
  const intervals = new Map();
  let fullMediaScans = 0;
  let sequence = 0;
  let sandbox;
  class Target {
    constructor() { this.listeners = new Map(); }
    addEventListener(type, callback, options = {}) {
      const values = this.listeners.get(type) || [];
      values.push(callback); this.listeners.set(type, values);
      events.push({ target: this, type, callback });
      options.signal?.addEventListener('abort', () => this.removeEventListener(type, callback), { once: true });
    }
    removeEventListener(type, callback) {
      this.listeners.set(type, (this.listeners.get(type) || []).filter(value => value !== callback));
    }
    async dispatch(type, target = this, extra = {}) {
      const event = { type, target, preventDefault() {}, stopPropagation() { this.stopped = true; },
        composedPath: () => { const path = []; for (let node = target; node; node = node.parentElement || node.host) path.push(node); return path; }, ...extra };
      for (let node = this; node; node = event.stopped ? null : node.parentElement || node.host) {
        for (const callback of node.listeners?.get(type) || []) await callback(event);
      }
    }
  }
  function selectors(selector) { return selector.split(',').map(value => value.trim()); }
  class Element extends Target {
    constructor(tag) {
      super(); this.tagName = tag.toUpperCase(); this.nodeType = 1; this.children = []; this.parentElement = null;
      this.attributes = new Map(); this.dataset = {}; this.textContent = ''; this.hidden = false;
      this.style = { setProperty(name, value) { this[name] = value; }, removeProperty(name) { delete this[name]; } };
      this.classList = { contains: value => this.className.split(/\s+/).includes(value),
        add: value => { this.className = `${this.className} ${value}`.trim(); },
        remove: value => { this.className = this.className.split(/\s+/).filter(item => item !== value).join(' '); } };
    }
    get id() { return this.getAttribute('id') || ''; }
    set id(value) { this.setAttribute('id', value); }
    get className() { return this.getAttribute('class') || ''; }
    set className(value) { this.setAttribute('class', value); }
    get isConnected() { return this === document.documentElement || Boolean((this.parentElement || this.host)?.isConnected); }
    get parentNode() { return this.parentElement; }
    get childNodes() { return this.children; }
    get firstChild() { return this.children[0] || null; }
    get content() {
      assert.equal(this.tagName, 'TEMPLATE');
      return { cloneNode: () => { const fragment = this.cloneNode(true); fragment.nodeType = 11; return fragment; } };
    }
    cloneNode(deep) {
      const clone = new Element(this.tagName);
      for (const [name, value] of this.attributes) clone.setAttribute(name, value);
      if (deep) clone.append(...this.children.map(child => child.cloneNode(true)));
      return clone;
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
    }
    getAttribute(name) { return this.attributes.get(name) ?? null; }
    hasAttribute(name) { return this.attributes.has(name); }
    removeAttribute(name) {
      this.attributes.delete(name);
      if (name.startsWith('data-')) delete this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())];
    }
    matches(selector) {
      return selectors(selector).some(value => {
        if (value === '*') return true;
        const tag = value.match(/^[a-z][\w-]*/i)?.[0];
        if (tag && tag.toUpperCase() !== this.tagName) return false;
        for (const [, id] of value.matchAll(/#([\w-]+)/g)) if (this.id !== id) return false;
        for (const [, cls] of value.matchAll(/\.([\w-]+)/g)) if (!this.classList.contains(cls)) return false;
        for (const [, name, expected] of value.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)) {
          const actual = name === 'href' ? this.href : this.getAttribute(name);
          if (actual == null || (expected !== undefined && actual !== expected)) return false;
        }
        return true;
      });
    }
    closest(selector) { for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node; return null; }
    contains(element) { return element === this || this.children.some(child => child.contains(element)); }
    querySelectorAll(selector) {
      if (this === document.documentElement && selector === 'video, img') fullMediaScans += 1;
      const result = [];
      for (const child of this.children) {
        if (child.matches(selector)) result.push(child);
        result.push(...child.querySelectorAll(selector));
      }
      return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    append(...elements) {
      for (const element of elements) {
        if (element.nodeType === 11) { this.append(...element.children); continue; }
        element.remove(); element.parentElement = this; this.children.push(element);
        if (element.tagName === 'SCRIPT' && element.type !== 'application/json' && element.textContent) {
          vm.runInContext(element.textContent, sandbox);
        }
      }
    }
    appendChild(element) { this.append(element); return element; }
    replaceChildren(...elements) { for (const child of [...this.children]) child.remove(); this.append(...elements); }
    remove() {
      if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(value => value !== this);
      this.parentElement = null;
    }
    attachShadow() { const shadow = new Element('shadow-root'); shadow.host = this; this.shadowRoot = shadow; return shadow; }
    getBoundingClientRect() {
      const rect = this.rect || { left: 0, top: 0, width: 340, height: 60 };
      return { ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height };
    }
    getClientRects() { return this.isConnected && !this.hidden ? [this.getBoundingClientRect()] : []; }
    set innerHTML(html) {
      this.replaceChildren();
      const stack = [this];
      for (const match of html.matchAll(/<([^>]+)>/g)) {
        const token = match[1];
        if (token.startsWith('/')) { if (stack.length > 1) stack.pop(); continue; }
        if (token.startsWith('!')) continue;
        const tag = token.match(/^[^\s/]+/)?.[0]; if (!tag) continue;
        const node = new Element(tag);
        for (const [, key, value] of token.matchAll(/([\w-]+)="([^"]*)"/g)) node.setAttribute(key, value);
        stack.at(-1).append(node);
        if (!/^(img|input|br|hr|meta|link)$/i.test(tag) && !token.endsWith('/')) stack.push(node);
      }
    }
  }
  const document = new Target();
  document.documentElement = new Element('html');
  document.body = new Element('body'); document.documentElement.append(document.body);
  document.createElement = tag => new Element(tag);
  document.querySelectorAll = selector => document.documentElement.querySelectorAll(selector);
  document.querySelector = selector => document.querySelectorAll(selector)[0] || null;
  document.getElementById = id => document.querySelectorAll('[id]').find(element => element.id === id) || null;
  const window = new Target();
  sandbox = { document, location: { hostname: 'www.instagram.com', href }, AbortController, TextEncoder, URL, console,
    innerWidth: 1400, innerHeight: 1000,
    getComputedStyle: element => ({ display: element.hidden ? 'none' : 'block', visibility: 'visible', opacity: '1', overflow: 'visible', overflowX: 'visible', overflowY: 'visible', ...element.computedStyle }),
    addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window),
    requestAnimationFrame: callback => { const id = ++sequence; frames.set(id, callback); return id; },
    cancelAnimationFrame: id => frames.delete(id),
    setTimeout: () => ++sequence, clearTimeout() {},
    setInterval: callback => { const id = ++sequence; intervals.set(id, callback); return id; }, clearInterval: id => intervals.delete(id),
    MutationObserver: class { constructor(callback) { this.callback = callback; observers.push(this); } observe() {} disconnect() {} },
    ResizeObserver: class { observe() {} unobserve() {} disconnect() {} },
    GM: { xmlHttpRequest(options) { requests.push(options.url); options.onerror({ error: 'intentional transport stop' }); return { abort() {} }; } },
  };
  sandbox.window = sandbox; sandbox.top = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  function flush() {
    let remaining = 20;
    while (frames.size && remaining-- > 0) {
      const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(0));
    }
    assert.equal(frames.size, 0, 'toolbar reconciliation must settle');
  }
  function notify(records = [{ type: 'childList', target: document.body, addedNodes: document.body.children, removedNodes: [] }]) {
    observers.forEach(observer => observer.callback(records)); flush();
  }
  function addMedia(code, { tag = 'img', id = code, left = 100, top = 100, width = 360, height = 400, parent = document.body } = {}) {
    const article = new Element('article'); parent.append(article);
    const link = new Element('a'); link.href = `https://www.instagram.com/p/${code}/`; article.append(link);
    const wrapper = new Element('div'); article.append(wrapper);
    const media = new Element(tag); media.rect = { left, top, width, height }; wrapper.append(media);
    media.src = `${cdn}/${id}.${tag === 'video' ? 'mp4' : 'jpg'}`; media.currentSrc = media.src;
    media.naturalWidth = media.videoWidth = width; media.naturalHeight = media.videoHeight = height;
    media.duration = tag === 'video' ? 5 : NaN;
    const item = { id, code, isVideo: tag === 'video', dimensions: { width, height }, src: media.src,
      ...(tag === 'video' ? { videoUrl: media.src, hasAudio: true, videoResources: [{ src: media.src, configWidth: width, configHeight: height }] }
        : { displayResources: [{ src: media.src, configWidth: width, configHeight: height }] }) };
    Object.defineProperty(media, '__reactFiber$test', { value: { memoizedProps: { media: item }, return: { memoizedProps: { post: item }, return: null } } });
    return { media, article, wrapper, item };
  }
  const inject = () => { vm.runInContext(source, sandbox, { filename: 'insta-loader.user.js' }); flush(); };
  const host = () => document.getElementById('insta-loader-controls');
  const panels = () => host()?.shadowRoot.querySelectorAll('.media-controls') || [];
  const click = async (panel, action = 'download') => { const button = panel.querySelector(`[data-action="${action}"]`); assert.ok(button); await button.dispatch('click'); flush(); };
  return { document, window, sandbox, events, requests, intervals, addMedia, inject, host, panels, click, notify, flush,
    get fullMediaScans() { return fullMediaScans; } };
}

test('media toolbars bind clicks to their own post, even when another visible post is larger', async () => {
  const page = toolbarPage();
  page.addMedia('SMALL', { left: 80, top: 100, width: 320, height: 320 });
  page.addMedia('LARGE', { left: 600, top: 100, width: 550, height: 700 });
  page.inject();
  assert.equal(page.panels().length, 2);
  for (const panel of page.panels()) {
    assert.deepEqual(panel.querySelectorAll('button').map(button => button.dataset.action), ['open', 'all', 'download']);
    await page.click(panel);
  }
  assert.equal(page.requests.length, 2);
  assert.deepEqual([...page.requests].sort(), [`${cdn}/LARGE.jpg`, `${cdn}/SMALL.jpg`]);
});

test('a feed video linked to its Reel inside an article gets a toolbar for that media', async () => {
  const page = toolbarPage();
  const { media, article, wrapper } = page.addMedia('FEED_REEL', { id: '111', tag: 'video' });
  const audio = page.document.createElement('a');
  audio.href = 'https://www.instagram.com/reels/audio/39263539809911949/';
  article.append(audio);
  const mediaLink = page.document.createElement('a');
  mediaLink.href = 'https://www.instagram.com/reels/FEED_REEL/';
  wrapper.append(mediaLink); mediaLink.append(media);
  page.inject();
  assert.equal(page.panels().length, 1);
  await page.click(page.panels()[0]);
  assert.deepEqual(page.requests, [`${cdn}/111.mp4`]);
});

test('a video portal reads its nearby DOM post data once and rejects a different parent post', async t => {
  for (const parentCode of ['POST', 'OTHER']) await t.test(parentCode, async () => {
    const page = toolbarPage();
    const { media, wrapper, item } = page.addMedia('POST', { id: '111', tag: 'video' });
    let globalReads = 0;
    const playbackFiber = { get memoizedProps() { globalReads += 1; return { setGlobalVideoPortsManager() {} }; }, return: null };
    const mediaFiber = media.__reactFiber$test;
    mediaFiber.memoizedProps = { media: { id: '111' } }; mediaFiber.return = playbackFiber;
    let inner = media;
    for (let level = 0; level < 6; level += 1) {
      const parent = page.document.createElement('div');
      Object.defineProperty(parent, '__reactFiber$test', { value: playbackFiber });
      wrapper.append(parent); parent.append(inner); inner = parent;
    }
    Object.defineProperty(wrapper, '__reactFiber$test', { value: { memoizedProps: { post: { ...item, code: parentCode } }, return: playbackFiber } });
    Object.defineProperty(page.document.body, '__reactFiber$outside', { get() { throw new Error('Capture left the article.'); } });
    page.inject();
    assert.equal(page.panels().length, 1);
    await page.click(page.panels()[0]);
    assert.equal(globalReads, 1, 'shared playback fibers must not be rewalked for each DOM ancestor');
    assert.deepEqual(page.requests, parentCode === 'POST' ? [`${cdn}/111.mp4`] : []);
    if (parentCode === 'OTHER') assert.match(page.panels()[0].querySelector('.status').textContent, /exact post or Story/);
  });
});

test('repeat startup and reconciliation do not duplicate media controls or listeners; removed media loses controls', () => {
  const page = toolbarPage();
  const first = page.addMedia('FIRST');
  page.inject();
  assert.equal(page.panels().length, 1);
  const host = page.host();
  const snapshot = [...page.events];
  page.inject();
  assert.equal(page.host(), host);
  assert.deepEqual(page.events, snapshot);
  page.notify(); page.notify();
  assert.equal(page.panels().length, 1);
  const second = page.addMedia('SECOND', { left: 600 });
  page.notify([{ type: 'childList', target: page.document.body, addedNodes: [second.article], removedNodes: [] }]);
  assert.equal(page.panels().length, 2);
  first.article.remove();
  page.notify([{ type: 'childList', target: page.document.body, addedNodes: [], removedNodes: [first.article] }]);
  assert.equal(page.panels().length, 1);
  second.article.remove();
  page.notify([{ type: 'childList', target: page.document.body, addedNodes: [], removedNodes: [second.article] }]);
  assert.equal(page.panels().length, 0);
});

test('a stale toolbar cannot silently select replacement media before reconciliation', async () => {
  const page = toolbarPage();
  const { media } = page.addMedia('FIRST');
  page.inject();
  const panel = page.panels()[0];
  media.currentSrc = media.src = `${cdn}/REPLACEMENT.jpg`;
  await page.click(panel);
  assert.deepEqual(page.requests, []);
});

test('every toolbar action rejects unowned media despite an exact post record elsewhere on the page', async t => {
  for (const action of ['open', 'download', 'all']) await t.test(action, async () => {
    const page = toolbarPage('https://www.instagram.com/p/POST/');
    page.addMedia('POST', { id: '111', left: 100, width: 400, height: 400 });
    const unrelated = page.addMedia('UNRELATED', { id: '222', left: 600, width: 500, height: 600 });
    unrelated.article.querySelector('a').remove();
    const metadata = page.document.createElement('script');
    metadata.type = 'application/json'; metadata.setAttribute('type', 'application/json');
    metadata.textContent = JSON.stringify(image('111', 'POST', 400));
    page.document.body.append(metadata);
    page.inject();
    const panel = page.panels()[0];
    assert.match(panel.style.cssText, /left:600px/, 'exercise the toolbar attached to the larger unowned image');
    await page.click(panel, action);
    assert.deepEqual(page.requests, [], 'a matching page record must not authorize a different displayed element');
    assert.match(panel.querySelector('.status').textContent, /could not be identified/);
  });
});

test('every action still resolves blob Reel playback through its component item ID', async t => {
  for (const action of ['open', 'download', 'all']) await t.test(action, async () => {
    const page = toolbarPage('https://www.instagram.com/reel/POST/');
    const { media, article } = page.addMedia('POST', { id: '111', tag: 'video' });
    article.querySelector('a').remove();
    media.src = media.currentSrc = 'blob:https://www.instagram.com/current-playback';
    page.inject();
    assert.equal(page.panels().length, 1);
    await page.click(page.panels()[0], action);
    assert.deepEqual(page.requests, [`${cdn}/111.mp4`]);
    assert.match(page.panels()[0].querySelector('.status').textContent, /intentional transport stop/);
  });
});

test('Story toolbar belongs to the central item and safely rebinds a reused media element', async () => {
  const page = toolbarPage('https://www.instagram.com/stories/person/123/');
  page.addMedia('LEFT', { id: '111', left: 20, width: 320, height: 400 });
  const current = page.addMedia('STORY', { id: '123', left: 500, width: 400, height: 700 });
  page.addMedia('RIGHT', { id: '999', left: 1050, width: 320, height: 400 });
  page.inject();
  assert.equal(page.panels().length, 1);
  const panel = page.panels()[0];
  assert.match(panel.style.cssText, /left:500px/);
  await page.click(panel);
  assert.deepEqual(page.requests, [`${cdn}/123.jpg`]);
  page.sandbox.location.href = 'https://www.instagram.com/stories/person/124/';
  current.media.currentSrc = current.media.src = `${cdn}/124.jpg`;
  current.item.id = '124'; current.item.src = current.media.src;
  current.item.displayResources[0].src = current.media.src;
  await page.click(panel);
  assert.equal(page.requests.length, 1, 'an unreconciled toolbar must not choose a new Story');
  assert.equal(page.panels().length, 1);
  await page.click(page.panels()[0]);
  assert.deepEqual(page.requests, [`${cdn}/123.jpg`, `${cdn}/124.jpg`]);
});

test('Story toolbar rejects mismatched media metadata for current and all-item actions', async () => {
  const page = toolbarPage('https://www.instagram.com/stories/person/123/');
  page.addMedia('WRONG', { id: '999', left: 500, width: 400, height: 700 });
  page.inject();
  assert.equal(page.panels().length, 1);
  await page.click(page.panels()[0]);
  await page.click(page.panels()[0], 'all');
  assert.deepEqual(page.requests, []);
  assert.match(page.panels()[0].querySelector('.status').textContent, /exact post or Story/);
});

test('an overlapping video and poster receive one toolbar that selects the video', async () => {
  const page = toolbarPage();
  page.addMedia('POST', { id: 'poster', width: 400, height: 500 });
  page.addMedia('POST', { id: 'video', tag: 'video', width: 400, height: 500 });
  page.inject();
  assert.equal(page.panels().length, 1);
  await page.click(page.panels()[0]);
  assert.deepEqual(page.requests, [`${cdn}/video.mp4`]);
});

test('scrolling repositions and hides attached controls without rediscovering all media', async () => {
  const page = toolbarPage();
  const { media } = page.addMedia('POST');
  page.inject();
  const scans = page.fullMediaScans;
  media.rect.top = 250;
  await page.window.dispatch('scroll'); page.flush();
  assert.match(page.panels()[0].style.cssText, /top:250px/);
  media.rect.top = 1100;
  await page.window.dispatch('scroll'); page.flush();
  assert.equal(page.panels().length, 0);
  media.rect.top = 100;
  await page.window.dispatch('scroll'); page.flush();
  assert.equal(page.panels().length, 1);
  assert.equal(page.fullMediaScans, scans);
});

test('profile tiles and hidden media do not receive download controls', () => {
  const page = toolbarPage();
  const tile = page.addMedia('TILE');
  const tileLink = tile.article.querySelector('a');
  tileLink.append(tile.media); page.document.body.append(tileLink); tile.article.remove();
  const wrappedTile = page.addMedia('WRAPPED_TILE');
  const outerLink = page.document.createElement('a');
  outerLink.href = 'https://www.instagram.com/p/WRAPPED_TILE/';
  page.document.body.append(outerLink); outerLink.append(wrappedTile.article);
  const account = page.addMedia('ACCOUNT');
  const accountLink = page.document.createElement('a');
  accountLink.href = 'https://www.instagram.com/someone/';
  account.wrapper.append(accountLink); accountLink.append(account.media);
  const hidden = page.addMedia('HIDDEN');
  hidden.wrapper.setAttribute('aria-hidden', 'true');
  page.inject();
  assert.ok(page.host());
  assert.equal(page.panels().length, 0);
});

test('navigation cancels an outstanding request and clears the previous media action', async () => {
  const page = toolbarPage('https://www.instagram.com/p/POST/');
  page.addMedia('POST');
  let aborted = 0;
  page.sandbox.GM.xmlHttpRequest = options => {
    page.requests.push(options.url);
    return { abort() { aborted += 1; } };
  };
  page.inject();
  const pending = page.click(page.panels()[0]);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.requests.length, 1);
  page.sandbox.location.href = 'https://www.instagram.com/p/OTHER/';
  page.notify();
  await pending;
  assert.equal(aborted, 1);
  assert.equal(page.intervals.size, 0);
  assert.equal(page.panels().length, 0);
});


test('audio collections and external URLs are not Instagram posts', () => {
  assert.equal(core.parseRoute('https://www.instagram.com/reels/audio/27726369873725963/').kind, 'browse');
  assert.equal(core.parseRoute('https://example.com/p/POST/').kind, 'browse');
});

test('single-photo component with an empty sidecar list remains a single photo', () => {
  const [record] = core.exactRecords({id:'123',code:'POST',isSidecar:false,sidecarChildren:[],isVideo:false,displayResources:[{src:`${cdn}/wide.jpg`,configWidth:1440,configHeight:810}]},route);
  assert.equal(record.count,1);
  assert.equal(record.complete,true);
  assert.equal(record.items[0].variants[0].width,1440);
});

test('page-context capture copies only exact displayed media metadata and nearest item IDs', () => {
  const vm = require('node:vm');
  assert.equal(typeof core.captureDisplayedMedia,'function');
  const post = {
    id:'111',code:'POST',isSidecar:true,caption:'caption-secret',tracking:'tracking-secret',
    owner:{username:'artist',email:'email-secret'},
    sidecarChildren:[{id:'222',isVideo:false,dimensions:{width:1440,height:810},src:`${cdn}/photo.jpg`,displayResources:[{src:`${cdn}/photo.jpg`,configWidth:1440,configHeight:810,tracking:'resource-secret'}],sidecarChildren:[{id:'nested-secret'}]}],
  };
  const nearest = {id:'222',src:`${cdn}/photo.jpg`,caption:'child-secret'};
  const marked = {getAttribute:name => name === 'data-insta-loader-read' ? 'capture-test' : null};
  Object.defineProperty(marked,'__reactFiber$test',{value:{memoizedProps:{media:nearest,unrelated:{code:'POST',src:`${cdn}/outside.jpg`}},return:{memoizedProps:{post},return:null}}});
  const output = {tagName:'SCRIPT',type:'application/json',textContent:''};
  const document = {
    getElementById:id => id === 'capture-test' ? output : null,
    querySelectorAll:selector => { assert.equal(selector,'[data-insta-loader-read]');return [marked]; },
  };
  Object.defineProperty(document,'body',{get() { throw new Error('The capture must not inspect unrelated page content.'); }});
  const sandbox = {document,TextEncoder,unrelatedStore:{code:'POST',caption:'outside-secret',src:`${cdn}/outside.jpg`}};
  vm.createContext(sandbox);
  vm.runInContext(`(${core.captureDisplayedMedia.toString()})('capture-test',{kind:'post',token:'POST'});`,sandbox);
  const result = JSON.parse(output.textContent);
  assert.deepEqual(result.itemIds,['222','111']);
  assert.equal(result.nodes.length,1);assert.equal(result.nodes[0].code,'POST');
  assert.deepEqual(result.nodes[0].owner,{username:'artist'});
  assert.deepEqual(result.nodes[0].sidecarChildren[0].displayResources,[{src:`${cdn}/photo.jpg`,configWidth:1440,configHeight:810}]);
  assert.equal(result.nodes[0].sidecarChildren[0].sidecarChildren,undefined);
  assert.doesNotMatch(output.textContent,/secret|caption|tracking|email|outside\.jpg/);
  vm.runInContext(`(${core.captureDisplayedMedia.toString()})('capture-test',{kind:'post',token:'OTHER'});`,sandbox);
  const wrongPost = JSON.parse(output.textContent);
  assert.deepEqual(wrongPost.nodes,[]);assert.match(wrongPost.error,/exact post or Story/);
});
