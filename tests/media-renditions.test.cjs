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

  test(`${name}: a complete video URL retains its own dimensions`, () => {
    const item = mixedCarousel(schema).items[2];
    assert.equal(item.kind, 'video');
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

test('the byte validator accepts the normalized 900×720 MP4 and still enforces dimensions', async () => {
  const item = mixedCarousel(schemas.camel).items[2];
  const signal = new AbortController().signal;
  const result = await validateBytes(mp4Headers(900, 720), item, item.variants[0], signal);
  assert.equal(result.width, 900);
  assert.equal(result.height, 720);
  assert.equal(result.hasAudio, true);
  assert.equal(result.ext, 'mp4');
  await assert.rejects(validateBytes(mp4Headers(640, 512), item, item.variants[0], signal), /smaller than the rendition/);
});

test('a silent video must still meet its advertised dimensions regardless of audio metadata', async () => {
  const signal = new AbortController().signal;
  const variant = { url: mediaURL('video-only.mp4'), width: 900, height: 720, bitrate: 0 };
  for (const hasAudio of [true, false, null, undefined]) {
    await assert.rejects(validateBytes(mp4Headers(640, 512, false), { kind: 'video', hasAudio }, variant, signal), /smaller than the rendition/);
  }
});

test('a complete silent video is accepted regardless of audio metadata', async () => {
  const variant = { url: mediaURL('silent.mp4'), width: 900, height: 720, bitrate: 0 };
  const bytes = mp4Headers(900, 720, false);
  for (const hasAudio of [true, false, null, undefined]) {
    const result = await validateBytes(bytes, { kind: 'video', hasAudio }, variant, new AbortController().signal);
    assert.ok(result.blob instanceof Blob);
    assert.equal(result.blob.type, 'video/mp4');
    assert.equal(result.blob.size, bytes.byteLength);
    assert.equal(result.ext, 'mp4');
    assert.equal(result.hasVideo, true);
    assert.equal(result.hasAudio, false);
    assert.equal(result.width, 900);
    assert.equal(result.height, 720);
  }
});

for (const [width, height] of [[900, 720], [1280, 1024]]) {
  test(`a dimensionless video lacking audio permits a ${width}×${height} complete rendition`, async () => {
    const unknown = { url: mediaURL('unknown-video-only.mp4'), width: 0, height: 0, bitrate: 0 };
    const known = { url: mediaURL('known-complete.mp4'), width, height, bitrate: 0 };
    const calls = [];
    const result = await prepareVariants([unknown, known], async variant => {
      calls.push(variant.url);
      const bytes = variant === unknown ? mp4Headers(900, 720, false) : mp4Headers(width, height, true);
      const validated = await validateBytes(bytes, { kind: 'video', hasAudio: null }, variant, new AbortController().signal);
      return { ...validated, source: variant.url };
    });
    assert.equal(result.source, known.url);
    assert.equal(result.hasAudio, true);
    assert.deepEqual(calls, [unknown.url, known.url]);
  });
}

test('a dimensionless silent video is saved without substituting a smaller rendition with audio', async () => {
  const unknown = { url: mediaURL('unknown-video-only.mp4'), width: 0, height: 0, bitrate: 0 };
  const smaller = { url: mediaURL('smaller-complete.mp4'), width: 640, height: 512, bitrate: 0 };
  const calls = [];
  const result = await prepareVariants([unknown, smaller], async variant => {
    calls.push(variant.url);
    const bytes = variant === unknown ? mp4Headers(900, 720, false) : mp4Headers(640, 512, true);
    const validated = await validateBytes(bytes, { kind: 'video', hasAudio: null }, variant, new AbortController().signal);
    return { ...validated, source: variant.url };
  });
  assert.equal(result.source, unknown.url);
  assert.equal(result.width, 900);
  assert.equal(result.height, 720);
  assert.equal(result.hasAudio, false);
  assert.equal(result.blob.type, 'video/mp4');
  assert.deepEqual(calls, [unknown.url]);
});

test('a smaller measured silent file is not saved if a larger advertised rendition fails', async () => {
  const unknown = { url: mediaURL('unknown-silent.mp4'), width: 0, height: 0, bitrate: 0 };
  const larger = { url: mediaURL('larger-unavailable.mp4'), width: 1280, height: 1024, bitrate: 0 };
  const calls = [];
  await assert.rejects(prepareVariants([unknown, larger], async variant => {
    calls.push(variant.url);
    if (variant === larger) throw new Error('The media request failed.');
    return validateBytes(mp4Headers(900, 720, false), { kind: 'video', hasAudio: null }, variant, new AbortController().signal);
  }), /media request failed/);
  assert.deepEqual(calls, [unknown.url, larger.url]);
});

for (const [width, height] of [[0, 0], [900, 720]]) {
  test(`a ${width ? 'known' : 'dimensionless'} silent rendition is saved if an equivalent source returns HTTP 403`, async () => {
    const silent = { url: mediaURL('silent.mp4'), width, height, bitrate: 0 };
    const unavailable = { url: mediaURL('equivalent-unavailable.mp4'), width: 900, height: 720, bitrate: 0 };
    const calls = [];
    let silentPrepared;
    const result = await prepareVariants([silent, unavailable], async variant => {
      calls.push(variant.url);
      if (variant === unavailable) throw new Error('The media server returned HTTP 403 instead of a complete file.');
      silentPrepared = await validateBytes(mp4Headers(900, 720, false), { kind: 'video', hasAudio: null }, variant, new AbortController().signal);
      return silentPrepared;
    });
    assert.equal(result, silentPrepared, 'reuse the validated silent candidate despite the later request error');
    assert.equal(result.width, 900);
    assert.equal(result.height, 720);
    assert.equal(result.hasAudio, false);
    assert.equal(result.blob.type, 'video/mp4');
    assert.deepEqual(calls, [silent.url, unavailable.url]);
  });
}

for (const [width, height] of [[0, 0], [900, 720]]) {
  for (const audioFirst of [false, true]) {
    test(`equivalent ${width ? 'known' : 'dimensionless'} sources prefer audio when the audio file is ${audioFirst ? 'first' : 'second'}`, async () => {
      const silent = { url: mediaURL('video-only.mp4'), width, height, bitrate: 0 };
      const complete = { url: mediaURL('complete.mp4'), width, height, bitrate: 0 };
      const variants = audioFirst ? [complete, silent] : [silent, complete];
      const calls = [];
      const result = await prepareVariants(variants, async variant => {
        calls.push(variant.url);
        const validated = await validateBytes(mp4Headers(900, 720, variant === complete), { kind: 'video', hasAudio: null }, variant, new AbortController().signal);
        return { ...validated, source: variant.url };
      });
      assert.equal(result.source, complete.url);
      assert.equal(result.hasAudio, true);
      assert.deepEqual(calls, width && audioFirst ? [complete.url] : variants.map(variant => variant.url));
    });
  }
}

test('equal advertised dimensions do not let audio displace a larger measured silent video', async () => {
  const larger = { url: mediaURL('larger-measured-silent.mp4'), width: 900, height: 720, bitrate: 0 };
  const smaller = { url: mediaURL('smaller-measured-audio.mp4'), width: 900, height: 720, bitrate: 0 };
  const calls = [];
  const result = await prepareVariants([larger, smaller], async variant => {
    calls.push(variant.url);
    const bytes = variant === larger ? mp4Headers(1280, 1024, false) : mp4Headers(900, 720, true);
    const validated = await validateBytes(bytes, { kind: 'video' }, variant, new AbortController().signal);
    return { ...validated, source: variant.url };
  });
  assert.equal(result.source, larger.url);
  assert.equal(result.width, 1280);
  assert.equal(result.height, 1024);
  assert.equal(result.hasAudio, false);
  assert.deepEqual(calls, [larger.url, smaller.url]);
});

test('an unreadable dimensionless video remains fatal even with another complete rendition', async () => {
  const unknown = { url: mediaURL('unreadable.mp4'), width: 0, height: 0, bitrate: 0 };
  const known = { url: mediaURL('known-complete.mp4'), width: 900, height: 720, bitrate: 0 };
  const calls = [];
  await assert.rejects(prepareVariants([unknown, known], async variant => {
    calls.push(variant.url);
    const bytes = variant === unknown ? new Uint8Array([0, 1, 2, 3]).buffer : mp4Headers(900, 720, true);
    const validated = await validateBytes(bytes, { kind: 'video', hasAudio: true }, variant, new AbortController().signal);
    return { ...validated, source: variant.url };
  }), /source without rendition dimensions could not be checked/);
  assert.deepEqual(calls, [unknown.url]);
});
