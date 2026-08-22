# insta-loader

`insta-loader` is a browser userscript for downloading media from Instagram. It
adds download controls directly to Instagram posts, stories, highlights, Reels,
and profile pages, then resolves the underlying photo or video URL and saves it
through the userscript manager.

This fork targets Safari on macOS with the App Store
[Userscripts extension](https://github.com/quoid/userscripts). It does not target
Tampermonkey or other userscript managers. It is based on SN-Koarashi's IG
Helper and is distributed under `GPL-3.0-only`.

## What it does

When the script runs on `https://*.instagram.com/*`, it watches the page for
Instagram media surfaces and injects small action buttons near the media. The
main controls are:

- **Download**: download the current visible photo or video.
- **Download All Resources**: collect every item in a carousel, story sequence,
  or highlight sequence. The dedicated post control skips the media picker and
  uses browser-sensitive download batches. Story and highlight controls skip
  the picker only when **Directly Download All Resources in the
  Story/Highlight** is enabled; otherwise they open the picker.
- **Open in New Tab**: open the resolved media URL directly, which is useful
  when you want to inspect the file before saving it.
- **Download Video Thumbnail**: save the still image associated with a video.
- **Open Image In Viewer**: open photos in an in-page viewer with zoom, pan, and
  rotate controls.

For multi-item posts, the ordinary **Download** action can still show a media
picker when direct-download settings are disabled. The dialog lists each
detected image or video, includes a checkbox for each resource, and offers both
**Download Selected Resources** and **Download All Resources**. The dedicated
double-chevron **Download All Resources** control skips this dialog.

## Supported Instagram surfaces

`insta-loader` handles several Instagram page types:

- Feed posts and single post pages.
- Carousel posts with multiple photos and videos.
- Reels pages.
- Stories.
- Highlight stories.
- Profile avatars.

Stories and highlights include a small position counter when multiple story
items are available. Reels can also get optional scroll buttons for moving
through the Reels feed.

## How downloads are resolved

Instagram does not expose every downloadable file in the same way. The script
uses several strategies, depending on the page and settings:

- Reads visible media URLs from the current DOM when Instagram already loaded a
  usable photo URL.
- Uses the browser-delivered DOM and resource URLs as the default media source.
- Uses existing Instagram request fallbacks where a surface does not expose a
  complete resource directly.
- On Story and Highlight routes in Safari, retries affected Instagram JSON
  requests with an authenticated page-context fetch when Safari rejects the
  userscript request transport by policy.
- Fetches media through Safari or `GM.xmlHttpRequest`, creates a Blob URL, and
  triggers an ordinary browser download. Userscripts does not expose a download
  API.
- Captures high-quality image URLs from browser resource timing entries and
  stores them briefly in userscript storage, so a later button click can reuse a
  better image URL.
- Keeps Media API and DASH preference disabled by default so they do not replace
  the observed browser-delivered resource.

Safari uses slower media-detection intervals and smaller, more widely spaced
download groups. Generated object URLs are kept alive for 60 seconds so Safari
has enough time to finish its download handoff.

## Installation

Install and enable the App Store **Userscripts** extension for Safari. Give the
extension access to Instagram, then open this URL in Safari and install it with
Userscripts:

```text
https://raw.githubusercontent.com/paytonison/insta-loader/main/insta-loader.user.js
```

The userscript metadata uses the same raw GitHub URL for `@downloadURL` and
`@updateURL`, so Userscripts can update it from this repository.
Automatic install and update from that URL only work when the userscript file is
publicly accessible. If this repository is private, install or update the script
manually, or make the repository public before distributing it through the raw
GitHub URL. The raw `main` URL always serves the latest merged release; to test
an unmerged branch, install that checkout's root `insta-loader.user.js`
manually. After changing userscript metadata in a local script, open that script
in the Userscripts extension page and save it so the extension reparses the
metadata, then reload Instagram.

## Settings

Press `Alt+W` on Instagram to open the in-page settings dialog. Preferences are
loaded from the asynchronous Userscripts `GM.getValue` API before startup and
saved through `GM.setValue`.

Important settings include:

- **Automatically Rename Files**: save media with a template instead of
  Instagram's original CDN filename.
- **Set Renamed File Timestamp to Resource Publish Date**: use the media
  publish time in the filename template instead of the current download time.
- **Directly Download the Visible Resources in the Post**: make the post
  download button save the currently visible carousel item immediately.
- **Directly Download All Resources in the Post**: make the post download
  button fetch and save every detected post resource.
- **Directly Download All Resources in the Story/Highlight**: make story and
  highlight batch buttons download without first showing the picker dialog.
- **Force Fetch Resource via Media API** and **Prefer DASH Manifest** are legacy
  experimental paths and remain disabled by default. The browser-delivered
  resource is the supported download path.
- **Use Alternative Methods to Download When the Media API is Not Accessible**:
  fall back when the Media API is throttled or unavailable.
- **Capture Image Resource Using Media Cache**: watch image resource loads and
  cache high-quality URLs for later actions.
- **Play Standalone Reels at Maximum Quality** (enabled by default): on eligible
  singular Reel routes (`/reel/{shortcode}/`, `/reel/{shortcode}/embed/`, and
  `/{username}/reel/{shortcode}/`), briefly hold the Reel's poster while
  selecting Instagram's highest-resolution complete progressive MP4 with audio.
  If that source cannot be loaded within five seconds, continue with Instagram's
  native playback. The scrolling `/reels/` feed always keeps Instagram's native
  player.
- **Modify Resource EXIF Properties**: for supported image blobs, rewrite EXIF
  metadata with useful post information.
- **Display HTML5 Video Controller**, **Disable Video Auto-looping**, and
  **Modify Video Volume**: adjust video playback behavior while browsing.
- **Skip the Confirmation Page for Viewing a Story/Highlight** and **Skip
  "shared this with you" dialog on shared profile links**: remove common
  Instagram interstitials.

When both post direct-download settings are enabled, the ordinary **Download**
action follows **Directly Download the Visible Resources in the Post** first.
For a multi-item post, the dedicated double-chevron **Download All Resources**
control is shown when visible-resource downloading is enabled and automatic
all-resource downloading is disabled.

Right-click **Automatically Rename Files** in the settings dialog to edit the
filename template. Right-click **Modify Video Volume** to set the stored volume.

### Maximum-quality Reel playback

This setting applies only to stable singular Reel routes: `/reel/{shortcode}/`,
its `/embed/` form, and username-qualified `/{username}/reel/{shortcode}/`
routes. It starts when the active Reel plays and does not prefetch the next Reel.
The scrolling `/reels/` feed deliberately remains native because Instagram
recycles its video elements there, and replacing a recycled player's source can
leave a later Reel showing or pausing the preceding one. The script makes an
additional request to Instagram's private metadata endpoint only on eligible
standalone pages, so it can use more bandwidth and may encounter rate limits.
Throttling, metadata failures, unsupported sources, and timeouts fail open to
native playback.

Here, "maximum quality" means the highest-resolution complete progressive MP4
that Instagram reports for the Reel, with both video and audio in one file. It
does not combine separate DASH tracks. **Prefer DASH Manifest** remains a
download-only option, and a DASH download may offer a higher resolution than
the progressive file used for playback.

The userscript starts at `document-start` to catch playback as early as
possible. This is best effort: on a cold load, userscript-manager `@require`
resources can delay execution, so Instagram may render a native frame before
the quality handler is ready.

## Filename templates

The default filename template is:

```text
%USERNAME%-%SOURCE_TYPE%-%SHORTCODE%-%YEAR%%MONTH%%DAY%_%HOUR%%MINUTE%%SECOND%_%ORIGINAL_NAME_FIRST%
```

Available tokens include:

- `%USERNAME%`: Instagram username.
- `%SOURCE_TYPE%`: source category such as `photo`, `video`, `stories`,
  `reels`, `thumbnail`, or `avatar`.
- `%SHORTCODE%`: post shortcode or media/story identifier.
- `%YEAR%`, `%2-YEAR%`, `%MONTH%`, `%DAY%`, `%HOUR%`, `%MINUTE%`,
  `%SECOND%`: timestamp parts.
- `%ORIGINAL_NAME%`: original CDN filename without extension.
- `%ORIGINAL_NAME_FIRST%`: first underscore-separated part of the original CDN
  filename.
- `%INDEX%`: resource index for multi-item media.
- `%UID%`: Instagram user ID when it can be resolved.

If automatic renaming is disabled, the script falls back to a simpler
`username_originalname.ext` filename.

## Hotkeys

Default hotkeys:

- `Alt+Q`: close the `insta-loader` dialog.
- `Alt+W`: open or close preference settings.
- `Alt+C`: open or close hotkey settings.
- `Alt+Z`: open the debug DOM window.
- `Alt+R`: reload the script.
- `Alt+S`: download the current story or highlight resource.

Press `Alt+C` to open **Hotkey Settings**. `Alt+Q` and `Alt+R` are fixed.

## Permissions and external resources

The script requests the Userscripts APIs for style injection, asynchronous
storage, tab opening, and cross-origin requests. It does not request unavailable
menu, notification, or download APIs. It connects to `www.instagram.com`,
`i.instagram.com`, Instagram and Meta CDN hosts
(`*.cdninstagram.com`, `scontent.cdninstagram.com`, and `*.fbcdn.net`),
`raw.githubusercontent.com`, and `cdn.jsdelivr.net`.

Runtime dependencies and resources are provided as follows:

- jQuery 3.7.1 from `code.jquery.com`.
- Original IG Helper CSS, the locale manifest, and the English dictionary are
  bundled into the generated userscript from reviewed source files.
- Supported non-English dictionaries are loaded from an immutable,
  commit-pinned IG Helper URL on `cdn.jsdelivr.net`; missing or malformed locale
  data falls back to the bundled English dictionary.

## Troubleshooting

Instagram changes its DOM structure and private API responses often. If a
button disappears, a dialog stays on "Loading Blob Media", or a download cannot
find a URL, the resolver for that specific Instagram surface may need an update.

### Stories advance before the download resolves

A Story can move to the next slide before **Download** finishes resolving the
current photo or video. When that happens, pause the Story, choose **Open in New
Tab**, and then save the media manually from the opened tab.

Useful checks:

- Make sure you are logged in to Instagram. Some request fallbacks redirect to
  login when the session is missing or blocked.
- Try **Open in New Tab** first. If that works but **Download** fails, the media
  URL resolver is probably fine and the issue is in the browser download path.
- Keep **Force Fetch Resource via Media API** and **Prefer DASH Manifest**
  disabled while diagnosing the supported browser-resource path.
- Use **Debug Window** to capture the current DOM/log output for bug reports.

## Development and validation

The current checkout contains one installable artifact:
`insta-loader.user.js`. Check its JavaScript syntax with:

```sh
node --check insta-loader.user.js
```

Before publishing, install that exact file in Userscripts on Safari and verify
a single image, a video, a mixed carousel, a Reel, a Story, a Highlight, and a
profile avatar. Exercise visible and batch downloads, New Tab, thumbnails,
settings persistence, and Instagram SPA navigation. Confirm controls and
downloads are not duplicated after reload or navigation, and inspect the
downloaded image/video dimensions and file sizes rather than treating a
successful request as proof of media quality.

Do not commit cookies, credentials, private responses, captured private media,
or temporary test harnesses.

## Support

If you find `insta-loader` useful, you can support its development on
[Ko-fi](https://ko-fi.com/paytonison).

## License

`insta-loader` is distributed under `GPL-3.0-only`, matching the upstream IG
Helper license and the declaration in the installable userscript. See
[LICENSE](LICENSE) for the full terms.
