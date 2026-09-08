# Insta Loader

**Version 2.0.1** — a standalone Instagram media downloader for Safari on macOS with Tampermonkey.

[`insta-loader.user.js`](./insta-loader.user.js) adds a compact toolbar to visible photos and videos in posts, carousels, Reels, and the current Story. Open the selected file in a new tab, download one item, or save every item in a post. The entire downloader lives in one userscript; using it requires no build step, package installation, or external download service.

## Install and update

1. Install and enable [Tampermonkey for Safari](https://www.tampermonkey.net/), and allow it to run on Instagram.
2. Open the [latest userscript](https://raw.githubusercontent.com/paytonison/insta-loader/main/insta-loader.user.js), copy its complete contents, and paste them into a new script in Tampermonkey.
3. Save the script and reload Instagram. Disable older copies of Insta Loader or other Instagram downloaders to avoid overlapping controls.
4. Open a post, Reel, or Story. Allow the script's requests to Instagram's media CDN if Tampermonkey prompts.

To update, replace the code in your existing **Insta Loader** entry with the latest file, save it, and reload Instagram.

Safari with Tampermonkey is the documented setup. Other browsers and userscript managers, including the separate Userscripts app, are unverified for this version.

## Controls

The three buttons appear in the lower-left corner of the media. From left to right:

| Button | What it does |
| --- | --- |
| **Open** — arrow out of a square | Fetches and checks the current photo or video, then opens its media URL in a new tab. |
| **Download all** — stacked pages with an arrow | Downloads every item in the post, starting at the first carousel item and preserving its order. |
| **Download** — purple download button | Downloads the photo or video currently attached to that toolbar. |

Each visible feed post can have its own toolbar. Controls follow the media as you scroll and update when you change carousel items or navigate between posts. Profile thumbnails and neighboring Story previews do not get download controls.

For a single-item post, Reel, or Story, **Download all** saves one file. Story actions apply to the **currently open Story item**; they do not download an account's entire Story sequence.

Keep the selected media open and visible until the action finishes. Changing items, navigating away, or scrolling it out of view can cancel the action. Only one action runs at a time, and the other buttons are disabled while it is working.

### Saving files

The status beneath the buttons shows progress, dimensions, and whether a video includes audio. **Sent to Safari Downloads** means the file was handed to the browser; Safari controls the save dialog and final location.

Filenames include the account name when available, the post code or Story ID, and the item's position:

```text
username-POSTCODE-01.jpg
username-POSTCODE-02.mp4
```

**Download all** requires sources for every item before it starts. It then checks and sends each file individually. If a later item fails or the action is cancelled, earlier files may already have been sent; the status reports how many. Safari may present multiple save dialogs during a bulk download.

## Media quality

The script reads media data Instagram has already loaded into the page and matches it to the selected post, carousel item, or Story. For videos, it can use a complete file exposed by the matching player; for photos, it also considers the image sources available on the page.

Available files are ranked by resolution, then video bitrate when provided. **Best available** means the highest-ranked complete rendition exposed through those sources. It does not guarantee the creator's original upload or a higher resolution available only through streaming. If that rendition fails, the script reports the problem instead of silently saving a smaller one.

Before opening or saving a file, the script checks that:

- The response is a complete file from Instagram's media CDN.
- An image has a recognized format and can be decoded by the browser.
- A video is a complete, non-fragmented MP4 with a usable video track and an audio track, unless Instagram explicitly identifies it as silent.
- Image width and video pixel count are not below the advertised values, when those values are available.

Video checks inspect the file's container and tracks; they do not guarantee that every codec will play in every browser. The downloader does not re-encode media or combine separate audio and video streams.

## Limits

- A usable complete file must be exposed by the page. A preview or streaming-only source is not enough.
- The script does not reconstruct DASH/HLS streams, join media segments, or make private Instagram API or GraphQL requests.
- Downloads are restricted to HTTPS media URLs on `cdninstagram.com`, `fbcdn.net`, and their subdomains.
- Files larger than 512 MiB are rejected. Media requests time out after 60 seconds.
- Bulk downloading covers one post at a time. There is no profile-wide or account-wide download action.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| **No toolbar** | Check that Tampermonkey and Insta Loader are enabled and allowed on Instagram. Reload the page and open the actual post, Reel, or Story. |
| **The item cannot be identified, or no complete file is available** | Let the media finish loading, then retry. Reload the post if needed. Some items expose only streaming sources that this downloader cannot save. |
| **Not every carousel item is available** | Reload the post and retry **Download all**. It requires the complete set of item sources before starting. |
| **A media request fails or times out** | Check Tampermonkey's site permissions, content blockers, and your connection, then retry. |
| **The selected media changed or the action was cancelled** | Keep the intended item visible and open, then start the action again. |
| **A video has no audio track** | The file is rejected unless Instagram marks the video as silent. The downloader cannot attach a separate audio stream. |

## Development

Edit `insta-loader.user.js` directly. With Node.js installed, check its syntax from the repository directory:

```sh
node --check insta-loader.user.js
```

Syntax validation does not verify Instagram compatibility. Check behavior in Safari with Tampermonkey and inspect the saved files for the correct item, dimensions, playback, audio, and carousel order.

## License

[GNU General Public License v3.0 only](./LICENSE).
