'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { captureDisplayedMedia, exactRecords, joinPlayerSources, parseRoute } = require('../insta-loader.user.js');

const mediaURL = name => `https://scontent.cdninstagram.com/${name}`;
const postRoute = parseRoute('https://www.instagram.com/example/p/PopupCarousel/?img_index=2');
const player = (id, name) => ({
  videoFBID: id,
  implementations: [{ typename: 'VideoPlayerProgressiveImplementation', data: { hdSrc: mediaURL(`${name}.mp4`) } }],
});
const video = id => ({ id, isVideo: true, videoResources: [{ src: mediaURL(`${id}-video-only.mp4`), configWidth: 900, configHeight: 720 }] });
const image = id => ({ id, isVideo: false, displayResources: [{ src: mediaURL(`${id}.jpg`), configWidth: 1080, configHeight: 1080 }] });
const carousel = children => ({ id: '8000', shortcode: postRoute.token, isSidecar: true, sidecarChildren: children });

// Only the DOM/fiber surface consumed by the page-context reader is simulated.
// These tests establish source association, not Safari or media playback support.
function capture(route, props, tagName = 'VIDEO') {
  const requestId = 'test-selected-media';
  const output = { tagName: 'SCRIPT', type: 'application/json', textContent: '' };
  const article = { tagName: 'ARTICLE', parentElement: null };
  const element = {
    tagName,
    parentElement: article,
    getAttribute: name => name === 'data-insta-loader-read' ? requestId : null,
    __reactFiber$test: props.reduceRight((parent, memoizedProps) => ({ memoizedProps, return: parent }), null),
  };
  const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    getElementById: id => id === requestId ? output : null,
    querySelectorAll: selector => selector === '[data-insta-loader-read]' ? [element] : [],
  } });
  try {
    captureDisplayedMedia(requestId, route);
    return JSON.parse(output.textContent);
  } finally {
    if (original) Object.defineProperty(globalThis, 'document', original);
    else delete globalThis.document;
  }
}

function capturedRecord(result, route = postRoute) {
  return joinPlayerSources(exactRecords(result.nodes, route)[0], result.playerSources);
}

test('a popup carousel joins the selected player source to its exact video child only', () => {
  const post = carousel([image('8101'), video('8102'), video('8103')]);
  const result = capture(postRoute, [player('8102', 'selected-complete'), { post }]);
  assert.deepEqual(result.playerSources, [{ id: '8102', urls: [mediaURL('selected-complete.mp4')] }]);
  assert.ok(result.itemIds.includes('8102'));
  const record = capturedRecord(result);
  const original = exactRecords(post, postRoute)[0];
  assert.deepEqual(record.items[1].variants.map(variant => variant.url), [
    mediaURL('8102-video-only.mp4'), mediaURL('selected-complete.mp4'),
  ]);
  assert.deepEqual(record.items[0], original.items[0]);
  assert.deepEqual(record.items[2], original.items[2]);
  assert.deepEqual(record.items.map(item => item.id), ['8101', '8102', '8103']);
});

test('a carousel child ID with an owner suffix matches its exact player ID', () => {
  const post = carousel([video('8102_42')]);
  const result = capture(postRoute, [player('8102', 'selected-complete'), { post }]);
  assert.equal(capturedRecord(result).items[0].variants.at(-1).url, mediaURL('selected-complete.mp4'));
});

test('an unrelated player ID cannot supply a carousel child source', () => {
  const post = carousel([video('8102'), video('8103')]);
  const result = capture(postRoute, [player('9999', 'unrelated'), { post }]);
  assert.deepEqual(capturedRecord(result), exactRecords(post, postRoute)[0]);
});

test('an exact single post still receives its player source', () => {
  const post = { ...video('8201'), shortcode: postRoute.token, hasAudio: true };
  const result = capture(postRoute, [player('8201', 'single-complete'), { post }]);
  const item = capturedRecord(result).items[0];
  assert.equal(item.kind, 'video');
  assert.deepEqual(item.variants.map(variant => variant.url), [mediaURL('8201-video-only.mp4'), mediaURL('single-complete.mp4')]);
});

test('a Story identity fragment still receives its exact player source', () => {
  const route = parseRoute('https://www.instagram.com/stories/example/8301/');
  const result = capture(route, [player('8301', 'story-complete'), { storyItem: { id: '8301_42' } }]);
  const item = capturedRecord(result, route).items[0];
  assert.equal(item.kind, 'video');
  assert.deepEqual(item.variants.map(variant => variant.url), [mediaURL('story-complete.mp4')]);
});

test('a selected image does not collect player sources from nearby fibers', () => {
  const post = carousel([image('8101'), video('8102')]);
  const result = capture(postRoute, [player('8102', 'nearby-complete'), { post }], 'IMG');
  assert.deepEqual(result.playerSources, []);
  assert.deepEqual(capturedRecord(result), exactRecords(post, postRoute)[0]);
});

test('a direct-load video portal can join its player source to an embedded raw carousel record', () => {
  const id = '4011725157194167125';
  const result = capture(postRoute, [player(id, 'direct-complete')]);
  assert.deepEqual(result.nodes, []);
  assert.deepEqual(result.itemIds, [id]);
  assert.deepEqual(result.playerSources, [{ id, urls: [mediaURL('direct-complete.mp4')] }]);
  const payload = {
    shortcode: postRoute.token, id: '8000', media_type: 8, carousel_media: [
      { id: '8101', media_type: 1, image_versions2: { candidates: [{ url: mediaURL('first.jpg'), width: 1080, height: 1080 }] } },
      { id: `${id}_42`, media_type: 2, video_versions: [{ url: mediaURL('direct-video-only.mp4'), width: 900, height: 720 }] },
    ],
  };
  const original = exactRecords(payload, postRoute)[0];
  const record = joinPlayerSources(original, result.playerSources);
  assert.deepEqual(record.items[0], original.items[0]);
  assert.deepEqual(record.items[1].variants.map(variant => variant.url), [mediaURL('direct-video-only.mp4'), mediaURL('direct-complete.mp4')]);
  assert.equal(record.complete, true);
});

test('an exact player source converts an image-only identity into video while preserving its poster', () => {
  const result = capture(postRoute, [player('8401', 'preview-complete')]);
  const payload = {
    shortcode: postRoute.token, id: '8401', media_type: 1,
    image_versions2: { candidates: [{ url: mediaURL('preview.jpg'), width: 1080, height: 1080 }] },
  };
  const record = joinPlayerSources(exactRecords(payload, postRoute)[0], result.playerSources);
  assert.equal(record.items[0].kind, 'video');
  assert.deepEqual(record.items[0].variants, [{ url: mediaURL('preview-complete.mp4'), width: 0, height: 0, bitrate: 0 }]);
  assert.deepEqual(record.items[0].posters, [mediaURL('preview.jpg')]);
  assert.equal(record.complete, true);
});

