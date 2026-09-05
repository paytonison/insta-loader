# Insta Loader

A standalone Instagram downloader for **Safari on macOS with Tampermonkey**. One userscript adds three buttons to the bottom-right corner of Instagram:

| Button | Action |
| --- | --- |
| **Open** | Open the current photo or video file in a new tab. |
| **Download all** | Save every photo and video in the open post, in carousel order. |
| **Download** | Save the currently selected photo or video at the best available complete rendition. |

For a single-photo post, a Reel, or the current Story, **Download all** saves that one item. Story support covers the **currently open Story item**, not an account's entire Story sequence.

## Install

1. Install and enable [Tampermonkey for Safari](https://www.tampermonkey.net/), and allow it to run on Instagram.
2. Create a new script in Tampermonkey and replace the editor contents with [`insta-loader.user.js`](./insta-loader.user.js).
3. Save the script, keep other Instagram downloaders disabled while testing, and reload Instagram.
4. Open a post, Reel, or Story and use its three buttons. Allow the script's Instagram media requests if Tampermonkey prompts.

There is no build step, package installation, or Node/npm requirement to use the downloader. The installable file contains the entire implementation.

Safari may show a save dialog according to your own download settings. The status reports when a file has been sent to Safari Downloads; it cannot confirm where Safari ultimately saved it. Keep the selected item open while an action is running.

## Media quality and selection

The script reads records already loaded into the page and the component data attached to the currently displayed media, matching the exact post code or Story ID. It preserves the parent's carousel order and checks the selected child against that post. It also considers the selected image's `srcset` and the visible media source. A short-lived page-context reader copies only media identities, dimensions, file candidates, and the owner name; it removes its temporary nodes immediately. Navigation uses the newly displayed item's data; there is no extra post-page fetch.

Candidate files are ranked by dimensions, then video bitrate when available. The chosen response is checked before being opened or sent to Safari Downloads: images must decode, and video files must pass MP4 container and track checks with a video track and an audio track unless Instagram explicitly identifies the video as silent. Carousel filenames include their item number.

**Best available** means the largest acceptable complete rendition exposed through these page sources. It is not a promise of the creator's original upload or of a higher resolution supplied only through streaming. The script keeps signed media URLs intact and does not silently substitute a smaller rendition when the selected resolution fails.

The downloader makes no private Instagram API or GraphQL requests. It does not parse DASH/HLS manifests, collect streaming segments, remux tracks, or use an external download service. When Instagram exposes only a preview or a streaming source, the action reports that limitation. Media downloads are limited to Instagram's `cdninstagram.com` and `fbcdn.net` CDN domains.

## Checks

Optional development checks use Node's built-in tools and require no third-party packages:

```sh
node --check insta-loader.user.js
node --test test/*.test.js
```

Local tests cover selection and transport logic. They do not establish that a particular Instagram surface downloads correctly in Safari; that requires checking the saved files.

Live checks on September 4, 2026 used Safari with Tampermonkey 5.6.6240. The saved videos were inspected and decoded from beginning to end with FFmpeg; photo dimensions and content were checked from the saved JPEGs.

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
