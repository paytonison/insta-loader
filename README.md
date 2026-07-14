# insta-loader

`insta-loader` is a browser userscript for downloading media from Instagram. It
adds download controls directly to Instagram posts, stories, highlights, Reels,
and profile pages, then resolves the underlying photo or video URL and saves it
through the userscript manager.

This fork is maintained for practical Safari use, but the script metadata also
declares support for current Chrome, Edge, and Firefox builds. It is based on
SN-Koarashi's IG Helper and keeps the original GPL-3.0-only license.

## What it does

When the script runs on `https://*.instagram.com/*`, it watches the page for
Instagram media surfaces and injects small action buttons near the media. The
main controls are:

- **Download**: download the current visible photo or video.
- **Download All Resources**: collect every item in a carousel, story sequence,
  or highlight sequence and download them in a throttled batch without opening
  the media picker.
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

Safari gets more conservative timings by default: media detection runs slightly
slower, batch downloads use smaller groups, and object URLs are kept alive long
enough for Safari's download handoff.

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
GitHub URL.

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
- **Modify Resource EXIF Properties**: for supported image blobs, rewrite EXIF
  metadata with useful post information.
- **Display HTML5 Video Controller**, **Disable Video Auto-looping**, and
  **Modify Video Volume**: adjust video playback behavior while browsing.
- **Skip the Confirmation Page for Viewing a Story/Highlight** and **Skip
  "shared this with you" dialog on shared profile links**: remove common
  Instagram interstitials.

Right-click **Automatically Rename Files** in the settings dialog to edit the
filename template. Right-click **Modify Video Volume** to set the stored volume.

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
connects to Instagram CDN/API hosts, `raw.githubusercontent.com`, and
`cdn.jsdelivr.net`.

External runtime resources are loaded from:

- jQuery 3.7.1 from `code.jquery.com`.
- Mediabunny 1.34.5 from `cdn.jsdelivr.net`.
- Original IG Helper CSS and locale files from `cdn.jsdelivr.net`.

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

This repository intentionally keeps the userscript as a single file:

```text
insta-loader.user.js
```

After editing the script, run a syntax check:

```sh
node --check insta-loader.user.js
```

For documentation-only edits, `git diff --check` is enough to catch whitespace
problems:

```sh
git diff --check
```

Static checks are not a substitute for a live Instagram smoke test. For changes
that touch media detection, downloads, stories, Reels, or the image viewer,
install the local script in the userscript manager and verify the affected
control on a real Instagram page.
