# insta-loader

`insta-loader` is a browser userscript for downloading media from Instagram. It
adds download controls directly to Instagram posts, stories, highlights, Reels,
and profile pages, then resolves the underlying photo or video URL and saves it
through the userscript manager.

This fork is maintained for practical Safari use, but the script metadata also
declares support for current Chrome, Edge, and Firefox builds. It is based on
SN-Koarashi's IG Helper. See [License](#license) for the repository's unresolved
license-file mismatch.

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
- Calls Instagram's GraphQL or media endpoints to resolve a post, carousel,
  Reel, story, highlight, or avatar into its underlying resources.
- On Story and Highlight routes in Safari, retries affected Instagram JSON
  requests with an authenticated page-context fetch when Safari rejects the
  userscript request transport by policy.
- Uses `GM_download` when the userscript manager provides it.
- Falls back to fetching media as a blob and triggering a browser download when
  direct `GM_download` is unavailable or fails.
- Captures high-quality image URLs from browser resource timing entries and
  stores them briefly in userscript storage, so a later button click can reuse a
  better image URL.
- Optionally prefers DASH video manifests from Instagram's Media API. When a
  DASH video and audio stream are both available, the script tries to mux them
  into one MP4 with Mediabunny; if muxing fails, it falls back to separate
  stream downloads.

Safari uses slower media-detection intervals and smaller, more widely spaced
download groups. Across all supported browsers, generated object URLs are kept
alive for 60 seconds; that shared delay also gives Safari enough time to finish
its download handoff.

## Installation

Install a userscript manager first. Tampermonkey is the most commonly tested
choice for Safari.

Then install the script from:

```text
https://raw.githubusercontent.com/paytonison/insta-loader/main/insta-loader.user.js
```

The userscript metadata uses the same raw GitHub URL for `@downloadURL` and
`@updateURL`, so compatible managers can update it from this repository.
Automatic install and update from that URL only work when the userscript file is
publicly accessible. If this repository is private, install or update the script
manually, or make the repository public before distributing it through the raw
GitHub URL. The raw `main` URL always serves the latest merged release; to test
an unmerged branch, build that checkout and install its root
`insta-loader.user.js` manually.

## Settings

Open the userscript manager menu on Instagram and choose **Settings**. The
settings dialog is rendered inside Instagram and stores preferences through
`GM_setValue`.

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
- **Force Fetch Resource via Media API**: use Instagram's Media API for higher
  quality resources when possible.
- **Prefer DASH Manifest**: prefer DASH video resources through the Media API.
  This can produce higher-quality video, but it is slower and more fragile than
  direct URLs.
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

The settings, hotkey settings, debug, and story-download hotkeys can be changed
from the **Hotkey Settings** menu. `Alt+Q` and `Alt+R` are fixed.

## Permissions and external resources

The script requests userscript permissions for style injection, storage, menu
commands, notifications, downloads, tab opening, and cross-origin requests. It
connects to `www.instagram.com`, `i.instagram.com`, Instagram and Meta CDN hosts
(`*.cdninstagram.com`, `scontent.cdninstagram.com`, and `*.fbcdn.net`),
`raw.githubusercontent.com`, and `cdn.jsdelivr.net`.

Runtime dependencies and resources are provided as follows:

- jQuery 3.7.1 from `code.jquery.com`.
- Mediabunny 1.34.5 from `cdn.jsdelivr.net`.
- Original IG Helper CSS, the locale manifest, and the English dictionary are
  bundled into the generated userscript from reviewed source files.
- Supported non-English dictionaries are loaded from an immutable,
  commit-pinned IG Helper URL on `cdn.jsdelivr.net`; missing or malformed locale
  data falls back to the bundled English dictionary.

## Troubleshooting

Instagram changes its DOM structure and private API responses often. If a
button disappears, a dialog stays on "Loading Blob Media", or a download cannot
find a URL, the resolver for that specific Instagram surface may need an update.

Useful checks:

- Make sure you are logged in to Instagram. Some Media API paths redirect to
  login when the session is missing or blocked.
- Try **Open in New Tab** first. If that works but **Download** fails, the media
  URL resolver is probably fine and the issue is in the browser download path.
- Disable **Force Fetch Resource via Media API** if API requests are being
  throttled.
- Enable **Use Alternative Methods to Download When the Media API is Not
  Accessible** when Media API responses are unreliable.
- Use **Debug Window** to capture the current DOM/log output for bug reports.

## Development

Development requires Node.js 20.19 or newer and npm. Install the exact locked
toolchain dependencies with:

```sh
npm ci
```

### Source and generated artifact

The source of truth lives under `src/`. `src/index.js` is the esbuild entry
point, `src/userscript.meta.txt` owns the userscript metadata, and core
services, media helpers, local resources, localization, and the compatibility
runtime live in their corresponding subdirectories.

`insta-loader.user.js` remains the single installable userscript at the
repository root, but it is now a committed generated artifact. Do not edit it
directly. Build it from the modular source with:

```sh
npm run build
```

The build targets Safari 15.4, emits one classic IIFE with no runtime module
imports, and places the Tampermonkey metadata block at the first byte of the
file. CSS and reviewed JSON resources are bundled into that artifact.

Use the non-writing consistency and determinism checks when reviewing source or
generated-file changes:

```sh
npm run check:generated
npm run check:determinism
```

`check:generated` compares an in-memory build with the committed root file.
`check:determinism` builds twice and requires the two outputs to be
byte-identical.

### Tests and fixtures

Unit and DOM characterization tests run with Vitest:

```sh
npm test
```

Focused tests can be selected by path, for example:

```sh
npx vitest run tests/unit/core
npx vitest run tests/characterization
```

Sanitized Instagram-shaped HTML and JSON fixtures live under `tests/fixtures`.
They cover posts, carousels, Stories, Highlights, profiles, standalone Reels,
the plural Reels feed, API responses, redirects, throttling, and malformed
responses. Fixtures must never contain login cookies, credentials,
authenticated response headers, private account data, or private media.

Browser fixture tests use Playwright's Chromium, Firefox, and WebKit projects.
Install those browser runtimes once, then run the browser suite:

```sh
npx playwright install chromium firefox webkit
npm run test:browser
```

Run the complete local validation path with:

```sh
npm run validate
```

This rebuilds the userscript, verifies generated-file consistency and
determinism, checks userscript syntax and source linting, runs Vitest and
Playwright, and checks the working diff for whitespace errors. The Playwright
browser runtimes must already be installed.

Individual low-level checks remain available when narrowing a failure:

```sh
npm run check:syntax
npm run lint
npm run check:whitespace
```

### Release gate

Automated checks are necessary, but WebKit fixture coverage is not an
authenticated Safari/Tampermonkey smoke test. Before publishing a generated
`insta-loader.user.js`:

1. Run `npm ci`, install the three Playwright browser runtimes, and run
   `npm run validate`.
2. Confirm the committed root userscript matches `src/`, begins with the
   metadata block, declares Safari 15.4 or newer, and contains no development
   imports.
3. Install that exact generated root file in Tampermonkey on Safari while
   authenticated to Instagram.
4. Verify a single-image post, an ordinary video post, and a mixed carousel.
   Exercise visible download, all-resource download, New Tab, Thumbnail, Image
   Viewer, selected-batch download, and all-batch download.
5. Verify current-item and all-item actions for both Stories and Highlights,
   plus profile-avatar download.
6. Verify maximum-quality playback on a standalone Reel and the five-second
   fail-open path back to Instagram's native playback.
7. Scroll through at least eleven items in the plural `/reels/` feed, then
   reverse direction. Confirm Instagram retains native `blob:` playback and the
   userscript performs no quality-source handoff there.
8. Reload and navigate through Instagram's SPA routes to confirm settings and
   hotkeys persist without duplicated controls or actions.

Do not publish based only on syntax, Vitest, or Playwright results. Record any
part of the authenticated Safari matrix that could not be exercised, and do not
commit cookies, credentials, private responses, or captured private media.

## License

The installable userscript metadata and `package.json` declare
`GPL-3.0-only`. The repository's root `LICENSE` file currently contains the
Apache License 2.0. These declarations conflict; treat the repository's
licensing status as unresolved until the license file and metadata are
intentionally reconciled.
