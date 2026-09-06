# Insta Loader

A standalone Instagram downloader for **Safari on macOS with Tampermonkey**. One userscript places a three-button toolbar directly over the lower-right corner of each visible post’s media and the active Story:

| Button | Action |
| --- | --- |
| **Open** | Open the current photo or video file in a new tab. |
| **Download all** | Save every photo and video in the open post, in carousel order. |
| **Download** | Save the photo or video beneath that toolbar at the best available complete rendition. |

The toolbar follows its photo or video as you scroll and changes with the current carousel or Story item. Each visible feed post has its own toolbar; profile thumbnails and neighboring Story previews do not get one. Clicking a toolbar selects its attached media automatically.

For a single-photo post, a Reel, or the current Story, **Download all** saves that one item. Story support covers the **currently open Story item**, not an account's entire Story sequence.

## Install

1. Install and enable [Tampermonkey for Safari](https://www.tampermonkey.net/), and allow it to run on Instagram.
2. Create a new script in Tampermonkey and replace the editor contents with [`insta-loader.user.js`](./insta-loader.user.js).
3. Save the script, keep other Instagram downloaders disabled while testing, and reload Instagram.
4. Open a post, Reel, or Story and use its three buttons. Allow the script's Instagram media requests if Tampermonkey prompts.

There is no build step, package installation, or Node/npm requirement to use the downloader. The installable file contains the entire implementation.

Safari may show a save dialog according to your own download settings. The status reports when a file has been sent to Safari Downloads; it cannot confirm where Safari ultimately saved it. Keep the selected item open while an action is running.

## Media quality and selection

Each toolbar is bound to one displayed media element. The script reads records already loaded into the page and the component data attached to that element or its nearby media container, matching its exact post code or Story ID. Some feed players have a separate playback component tree; the reader checks up to 12 nearby DOM elements, stops at the article boundary, and avoids revisiting shared component data. It preserves the parent's carousel order and checks the selected child against that post. All three actions require a matching media ID or displayed source; the page address alone cannot authorize a download. The script also considers the selected image's `srcset` and the visible media source. A short-lived page-context reader copies only media identities, dimensions, file candidates, and the owner name; it removes its temporary nodes immediately. Navigation uses the newly displayed item's data; there is no extra post-page fetch.

Candidate files are ranked by dimensions, then video bitrate when available. The chosen response is checked before being opened or sent to Safari Downloads: images must decode, and video files must pass MP4 container and track checks with a video track and an audio track unless Instagram explicitly identifies the video as silent. Carousel filenames include their item number.

The Reels feed can expose only a small identity record while keeping its complete MP4 in the displayed player's progressive implementation. The reader preserves the feed's video fields and joins that already-loaded source only when the player's media ID matches the exact Reel record. It continues through nearby containers when the first record has no source. Across matching player snapshots, an available HD source takes precedence over SD; an HD failure does not trigger an SD retry. Adaptive-player manifests are not read.

Story media records can contain just an ID, with no video-type flag. For a selected video element, the reader also uses the exact matching player's complete source to identify those records as video. A photo element or a player with a different media ID cannot supply that missing video source.

**Best available** means the largest acceptable complete rendition exposed through these page sources. It is not a promise of the creator's original upload or of a higher resolution supplied only through streaming. The script keeps signed media URLs intact and does not silently substitute a smaller rendition when the selected resolution fails.

The downloader makes no private Instagram API or GraphQL requests. It does not parse DASH/HLS manifests, collect streaming segments, remux tracks, or use an external download service. When Instagram exposes only a preview or a streaming source, the action reports that limitation. Media downloads are limited to Instagram's `cdninstagram.com` and `fbcdn.net` CDN domains.

## Checks

Optional development checks use Node's built-in tools and require no third-party packages:

```sh
node --check insta-loader.user.js
node --test test/*.test.js
```

Local tests cover selection and transport logic. They do not establish that a particular Instagram surface downloads correctly in Safari; that requires checking the saved files.

### September 5, 2026: Story video identity repair

The complete-file error was reproduced on Story `3979248969268064365`. Its displayed video player supplied a complete progressive MP4 with the matching Story ID, but its separate media records contained only `id` or `pk`. The reader incorrectly required those records to already declare a video before attaching the player's source. It now accepts that exact source for the selected video element without requiring the missing flag.

The updated script was saved in the existing Safari/Tampermonkey 5.6.6240 editor. After reloading the editor, its SHA-256 matched the local file. The original Story downloaded as a matching 720 × 1280 H.264 MP4 with stereo AAC, 60.14 seconds, and **Open** played it in Safari. After advancing without reloading, **Download all** saved exactly the current Story `3979251047444929200` as a matching 720 × 1280 H.264 MP4 with stereo AAC, 14.95 seconds. Both saved files had the correct Story IDs in their filenames and passed full video/audio decode.

All 75 local tests, syntax validation, and whitespace checks passed. Added regressions cover all three actions with identity-only Story records, HD selection without an SD retry, mismatched players, streaming-only sources, unknown audio metadata, photo exclusion, and Story navigation. The Userscripts app and separate reference downloader remain unverified for this repair; other media types retain local regression coverage and were not rechecked live.

### September 5, 2026: Reels feed source repair

The error `Instagram has not exposed a complete file for this item. Let it load, then try again.` was reproduced on `/reels/DcvrVk5tbhv/`. Its raw media record lost its video type during page-context capture, and the reader missed the complete progressive MP4 supplied separately by its player. The repair handles both without additional Instagram requests or streaming reconstruction.

The updated script was saved in the existing Safari/Tampermonkey editor, preserving script settings. After reloading the editor, its SHA-256 matched the local file. All 64 local tests, syntax validation, and whitespace checks passed. New regressions cover raw feed records, exact player-ID matching across nearby containers, HD preference across multiple snapshots, missing complete sources, and exclusion of manifests and unrelated data.

Saved-file checks passed for the original Reel (720 × 1280 H.264, stereo AAC, 13.49 seconds) and the next Reel, `/reels/Dcp0GonTujj/`, reached without reloading (720 × 1280 H.264, stereo AAC, 14.54 seconds). Both files visually matched their displayed clips, had the correct shortcode in their filenames, and decoded fully with no video/audio errors. **Open** also played the second Reel's complete file in Safari. After navigating back to the original Reel, **Download all** saved exactly one file, byte-for-byte identical to its earlier current-item download.

These checks used Tampermonkey 5.6.6240; this repair remains unverified in the Userscripts app and against the separate reference downloader. Other media types retain local regression coverage but were not rechecked live during this repair.

### September 5, 2026: media-attached toolbars

The updated script was installed in Safari with Tampermonkey 5.6.6240. After saving and reloading the editor, its full contents matched the local userscript exactly. All 47 local tests and the syntax check passed. Live testing found and corrected linked feed videos being mistaken for profile tiles, and feed/standalone video players whose post data lives on a nearby DOM container. An unproven single-item assumption and a bulk-action ownership exception were removed.

| Check | Result |
| --- | --- |
| Single photo | Attached toolbar saved the correct 1440 × 810 JPEG; image content and decode checked. |
| Photo carousel | Reached through in-page navigation, advanced to item two, then saved both images at 1158 × 1544 and 935 × 1246 with ordered `01` and `02` filenames. Both files matched September 4's verified downloads byte for byte. |
| Open in new tab | Opened the selected second carousel photo at 935 × 1246. |
| Standalone Reel | Attached toolbar saved the matching 720 × 1280 H.264 video with stereo AAC, 28.4 seconds; full video/audio decode passed. |
| Feed video | Attached toolbar saved the matching 720 × 882 H.264 video with stereo AAC, 11.8 seconds; full video/audio decode passed. |
| Current Story video | Attached toolbar saved the exact current Story at 720 × 1280 with H.264 and stereo AAC, 41.9 seconds; content and full decode checked. |
| Scrolling and navigation | Separate toolbars appeared on two visible feed posts, followed media while scrolling, and rebound after carousel and Story/account navigation. Profile thumbnails remained without controls. |
| Unidentified media and stale selection | The live identification failure started no download; the observed video-container cause was then fixed and retested. Wrong-item rejection for all three actions, repeated initialization, and cancellation have local regression coverage. |
| Remaining live checks | Mixed photo/video carousel, static Story image, and same-media comparison against the separate IG Helper reference. The reference file remained unchanged. |

Safari's save dialogs were completed before the files above were inspected. Bulk requests can stack save dialogs; filenames retain the post's item order even when Safari presents the later dialog first. The script's own status still reports only that files were sent to Safari Downloads.

### September 4, 2026: initial downloader

These earlier checks preceded the media-attached toolbar change and used Safari with Tampermonkey 5.6.6240. The saved videos were inspected and decoded from beginning to end with FFmpeg; photo dimensions and content were checked from the saved JPEGs.

| Check | Result |
| --- | --- |
| Single photo reached through in-page profile navigation | Saved the correct 1440 × 810 JPEG without reloading the post. |
| Photo carousel, current item and bulk | Saved 1158 × 1544 and 935 × 1246 JPEGs with ordered `01` and `02` filenames; bulk started from item two and included both. |
| Reel | Saved 720 × 1280 H.264 with stereo AAC, 28.4 seconds; complete decode passed. |
| Standalone `/reels/…` viewer | Opened the matching playable Reel file among neighboring players. |
| Current Story video | Saved 720 × 1280 H.264 with stereo AAC, 15.6 seconds; complete decode passed and the Story code matched the requested numeric Story ID. |
| Open in new tab | Opened the matching Reel and the second carousel photo. |
| Repeated initialization and cancellation | Covered by local tests; the repeated-injection check confirms one toolbar and no extra listeners. |
| Blocked media request | Reported a local error and initiated no download. The Tampermonkey domain declarations were then corrected. |
| Mixed photo/video carousel and static Story image | Extraction is covered by local tests; saved-file checks on these two combinations remain unverified. |
| Separate reference downloader | Preserved unchanged; a same-media comparison run remains unverified. |

The script rejects fragmented MP4 files and streaming-only sources rather than rebuilding them. Its MP4 checks establish container structure and track presence, not universal codec playback support; the live decode results above apply to the tested files. A single downloaded file is limited to 512 MB to bound browser memory use.

## Troubleshooting

- **No buttons:** confirm the script and Tampermonkey are enabled for Instagram, then reload the page.
- **A media request is blocked:** check Tampermonkey's requested site access and any content blocker that applies to Instagram or its media CDN.
- **The selected item changed:** let the new item load and start the action again.
- **A complete file or every carousel item is unavailable:** reload the post and retry. The script reports missing media instead of filling the download with a nearby post, thumbnail, or unverified stream.
