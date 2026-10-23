'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { exactRecords, parseRoute, safeFilename, prepareVariants, validateBytes } = require('../insta-loader.user.js');

const route = parseRoute('https://www.instagram.com/example/p/PopupCarousel/?img_index=10');
const mediaURL = (name) => `https://scontent.cdninstagram.com/${name}`;
const schemas = {
  raw: {
    image: (url) => ({ media_type: 1, original_width: 3276, original_height: 2621, image_versions2: { candidates: [{ url, width: 2561, height: 2049 }] }, display_url: url }),
    video: (url) => ({ media_type: 2, original_width: 3276, original_height: 2621, video_versions: [{ url, width: 900, height: 720 }], video_url: url, has_audio: true }),
    carousel: (children) => ({ media_type: 8, carousel_media_count: 14, carousel_media: children }),
  },
  snake: {
    image: (url) => ({ __typename: 'GraphImage', dimensions: { width: 3276, height: 2621 }, display_resources: [{ src: url, config_width: 2561, config_height: 2049 }], display_url: url }),
    video: (url) => ({ __typename: 'GraphVideo', dimensions: { width: 3276, height: 2621 }, video_resources: [{ src: url, config_width: 900, config_height: 720 }], video_url: url, has_audio: true }),
    carousel: (children) => ({ __typename: 'GraphSidecar', edge_sidecar_to_children: { edges: children.map(node => ({ node })) } }),
  },
  camel: {
    image: (url) => ({ isVideo: false, dimensions: { width: 3276, height: 2621 }, displayResources: [{ src: url, configWidth: 2561, configHeight: 2049 }], src: url }),
    video: (url) => ({ isVideo: true, dimensions: { width: 3276, height: 2621 }, videoResources: [{ src: url, configWidth: 900, configHeight: 720 }], videoUrl: url, hasAudio: true }),
    carousel: (children) => ({ isSidecar: true, sidecarChildren: children }),
  },
};

function mixedCarousel(schema) {
  const children = Array.from({ length: 14 }, (_, i) => {
    const kind = i === 2 || i === 11 ? 'video' : 'image';
    return { id: String(1000 + i), ...schema[kind](mediaURL(`item-${i + 1}.${kind === 'video' ? 'mp4' : 'jpg'}`)) };
  });
  const post = { id: 'post-1', shortcode: route.token, owner: { username: 'example' }, ...schema.carousel(children) };
  return exactRecords({ unrelated: { shortcode: 'OtherPost', ...schema.image(mediaURL('other.jpg')) }, post }, route)[0];
}

for (const [name, schema] of Object.entries(schemas)) {
  test(`${name}: item 10 retains the dimensions belonging to its image URL`, () => {
    const item = mixedCarousel(schema).items[9];
    assert.equal(item.kind, 'image');
    assert.deepEqual(item.variants, [{ url: mediaURL('item-10.jpg'), width: 2561, height: 2049, bitrate: 0 }]);
  });

  test(`${name}: a complete video URL retains its own dimensions and audio metadata`, () => {
    const item = mixedCarousel(schema).items[2];
    assert.equal(item.kind, 'video');
    assert.equal(item.hasAudio, true);
    assert.deepEqual(item.variants, [{ url: mediaURL('item-3.mp4'), width: 900, height: 720, bitrate: 0 }]);
  });
}

test('scalar and dimensionless object URLs do not inherit dimensions from their parent item', () => {
  const items = [
    { display_url: mediaURL('scalar.jpg'), media_type: 1 },
    { src: mediaURL('src.jpg'), media_type: 1 },
    { displayResources: [{ src: mediaURL('object.jpg') }], media_type: 1 },
    { video_url: mediaURL('scalar.mp4'), media_type: 2 },
    { videoUrl: mediaURL('camel.mp4'), media_type: 2 },
    { video_resources: [{ src: mediaURL('object.mp4') }], media_type: 2 },
  ];
  for (const node of items) {
    const record = exactRecords({ shortcode: route.token, original_width: 3276, original_height: 2621, dimensions: { width: 3276, height: 2621 }, ...node }, route)[0];
    assert.equal(record.items[0].variants[0].width, 0);
    assert.equal(record.items[0].variants[0].height, 0);
  }
});

test('a dimensionless scalar URL does not outrank a separately advertised larger rendition', () => {
  const record = exactRecords({ shortcode: route.token, original_width: 3276, original_height: 2621, display_url: mediaURL('unknown.jpg'), display_resources: [
    { src: mediaURL('small.jpg'), config_width: 640, config_height: 512 },
    { src: mediaURL('large.jpg'), config_width: 2561, config_height: 2049 },
  ] }, route)[0];
  assert.deepEqual(record.items[0].variants.map(v => v.url), [mediaURL('large.jpg'), mediaURL('small.jpg'), mediaURL('unknown.jpg')]);
});

test('the profile popup keeps all 14 items in order with the correct identities and filenames', () => {
  const record = mixedCarousel(schemas.camel);
  assert.equal(route.kind, 'post');
  assert.equal(route.owner, 'example');
  assert.equal(route.index, 10);
  assert.equal(record.complete, true);
  assert.equal(record.count, 14);
  assert.deepEqual(record.items.map(item => item.id), Array.from({ length: 14 }, (_, i) => String(1000 + i)));
  assert.deepEqual(record.items.map(item => item.kind), ['image', 'image', 'video', 'image', 'image', 'image', 'image', 'image', 'image', 'image', 'image', 'video', 'image', 'image']);
  assert.equal(safeFilename(record, record.items[9], 10, 'jpg'), 'example-PopupCarousel-10.jpg');
  assert.equal(safeFilename(record, record.items[2], 3, 'mp4'), 'example-PopupCarousel-03.mp4');
});

test('a distinct URL without dimensions is inspected and can win at its measured resolution', async () => {
  const known = { url: mediaURL('known.jpg'), width: 2561, height: 2049, bitrate: 0 };
  const unknown = { url: mediaURL('unknown.jpg'), width: 0, height: 0, bitrate: 0 };
  const calls = [];
  const result = await prepareVariants([known, unknown], async variant => {
    calls.push(variant.url);
    return { source: variant.url, width: 3276, height: 2621 };
  });
  assert.equal(result.source, unknown.url);
  assert.deepEqual(calls, [unknown.url], 'the inspected winner should be reused');
});

test('a smaller measured URL does not displace a larger advertised rendition', async () => {
  const known = { url: mediaURL('known.jpg'), width: 2561, height: 2049, bitrate: 0 };
  const unknown = { url: mediaURL('unknown.jpg'), width: 0, height: 0, bitrate: 0 };
  const calls = [];
  const result = await prepareVariants([unknown, known], async variant => {
    calls.push(variant.url);
    return { source: variant.url, width: variant.width || 640, height: variant.height || 512 };
  });
  assert.equal(result.source, known.url);
  assert.deepEqual(calls, [unknown.url, known.url]);
});

test('a scalar alias and an explicit rendition of the same URL are fetched once with explicit dimensions', async () => {
  const url = mediaURL('alias.jpg');
  const calls = [];
  const result = await prepareVariants([
    { url, width: 0, height: 0, bitrate: 0 },
    { url, width: 2561, height: 2049, bitrate: 0 },
  ], async variant => {
    calls.push(variant);
    return { source: variant.url, width: variant.width, height: variant.height };
  });
  assert.equal(result.source, url);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].width, 2561);
  assert.equal(calls[0].height, 2049);
});

test('a failed dimensionless source prevents an unsupported best-quality claim', async () => {
  const unknown = mediaURL('unknown.jpg');
  await assert.rejects(prepareVariants([
    { url: mediaURL('known.jpg'), width: 2561, height: 2049, bitrate: 0 },
    { url: unknown, width: 0, height: 0, bitrate: 0 },
  ], async variant => {
    if (variant.url === unknown) throw new Error('The media request failed.');
    return { source: variant.url, width: variant.width, height: variant.height };
  }), /failed/i);
});

test('a failed highest advertised rendition does not fall back to a smaller file', async () => {
  const high = mediaURL('high.jpg');
  const calls = [];
  await assert.rejects(prepareVariants([
    { url: mediaURL('small.jpg'), width: 640, height: 512, bitrate: 0 },
    { url: high, width: 2561, height: 2049, bitrate: 0 },
  ], async variant => {
    calls.push(variant.url);
    throw new Error('The image file is smaller than the rendition Instagram advertised.');
  }), /smaller/);
  assert.deepEqual(calls, [high]);
});

test('an equivalent rendition can recover from a failed source without changing resolution', async () => {
  const first = mediaURL('first.mp4');
  const second = mediaURL('second.mp4');
  const calls = [];
  const result = await prepareVariants([
    { url: first, width: 900, height: 720, bitrate: 1_000_000 },
    { url: second, width: 900, height: 720, bitrate: 1_000_000 },
    { url: mediaURL('small.mp4'), width: 640, height: 512, bitrate: 1_000_000 },
  ], async variant => {
    calls.push(variant.url);
    if (variant.url === first) throw new Error('The media request failed.');
    return { source: variant.url, width: variant.width, height: variant.height };
  });
  assert.equal(result.source, second);
  assert.deepEqual(calls, [first, second]);
});

// Minimal structural MP4 fixtures exercise the production header validator;
// they contain no playable frames and cannot establish playback compatibility.
function mp4Headers(width, height, audio = true) {
  const box = (type, ...parts) => {
    const body = Buffer.concat(parts);
    const header = Buffer.alloc(8);
    header.writeUInt32BE(body.length + 8);
    header.write(type, 4);
    return Buffer.concat([header, body]);
  };
  const handler = kind => {
    const bytes = Buffer.alloc(24);
    bytes.write(kind, 8);
    return box('mdia', box('hdlr', bytes));
  };
  const tkhd = Buffer.alloc(84);
  tkhd.writeUInt32BE(width * 65536, 76);
  tkhd.writeUInt32BE(height * 65536, 80);
  const tracks = [box('trak', box('tkhd', tkhd), handler('vide'))];
  if (audio) tracks.push(box('trak', handler('soun')));
  const bytes = Buffer.concat([box('ftyp', Buffer.from('isom'), Buffer.alloc(4)), box('moov', ...tracks), box('mdat', Buffer.from([0]))]);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

test('the byte validator accepts the normalized 900×720 MP4 and still enforces dimensions and audio', async () => {
  const item = mixedCarousel(schemas.camel).items[2];
  const signal = new AbortController().signal;
  const result = await validateBytes(mp4Headers(900, 720), item, item.variants[0], signal);
  assert.equal(result.width, 900);
  assert.equal(result.height, 720);
  assert.equal(result.hasAudio, true);
  assert.equal(result.ext, 'mp4');
  await assert.rejects(validateBytes(mp4Headers(640, 512), item, item.variants[0], signal), /smaller than the rendition/);
  await assert.rejects(validateBytes(mp4Headers(900, 720, false), item, item.variants[0], signal), /no audio track/);
});
