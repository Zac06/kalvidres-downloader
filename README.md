# Kalvidres Downloader

> **Specific to the University of Padua (UniPD).** It only works on Moodle
> (`*.unipd.it`) with the Kaltura setup UniPD uses. The hosts are hardcoded in
> `manifests/*.json`, `src/background.js` (`mediaspace.unipd.it`) and the
> content-script match pattern. For another university, change those.
>
> Unofficial: not affiliated with or endorsed by UniPD, Kaltura or Moodle. For
> personal use on lessons you can already watch. It does not bypass DRM.

Adds a **Scarica video** button under the player on Moodle `mod_kalvidres`
pages, so a lesson can be saved as an MP4 without capturing the stream by hand.

The extension reads the Kaltura entry from the lesson page, asks Kaltura for
the available MP4 flavors, picks the highest resolution, and gives the direct
URL to the browser's download manager. If the entry is not available to an
anonymous Kaltura session, it reuses the session token (`ks`) from the player's
own manifest request.

## Build

```sh
./build.sh
```

This runs a small logic test and creates `dist/firefox/` and `dist/chrome/`
(unpacked folders) plus `dist/kalvidres-downloader-firefox.zip` and
`dist/kalvidres-downloader-chrome.zip` for sharing.

## Install

### Firefox

For a normal Firefox install, the extension must be signed by Mozilla. The
signing script uses an AMO API key/secret:

1. Create a free [Mozilla account](https://addons.mozilla.org/) and get
   credentials from
   <https://addons.mozilla.org/developers/addon/api/key/>.
2. Copy `.env.example` to `.env` and fill in the two values, or export them:
   ```sh
   export WEB_EXT_API_KEY='...'
   export WEB_EXT_API_SECRET='...'
   ```
3. Run:
   ```sh
   ./sign.sh
   ```
4. The signed file appears in `dist/signed/`. Drag that `.xpi` onto
   `about:addons` (or open it) and confirm the install.

AMO rejects an existing version, so bump `version` in both manifests before
signing again. If you fork this, also change `gecko.id` in
`manifests/firefox.json`: AMO refuses an ID that belongs to another account.

Signed installs do not update themselves. Get the signed `.xpi` and the Chrome
zip from the GitHub Releases page, and install the new file again for each
release.

For development only, you can still use `about:debugging#/runtime/this-firefox`
→ **Load Temporary Add-on** → `dist/firefox/manifest.json`.

If the button does not appear, open `about:addons` → **Kalvidres Downloader** →
**Permissions** and make sure access to `stem.elearning.unipd.it`,
`mediaspace.unipd.it` and `cdnapisec.kaltura.com` is allowed.

### Chrome / Chromium

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `dist/chrome/`.

## Use

1. Open a lesson such as
   `https://stem.elearning.unipd.it/mod/kalvidres/view.php?id=...`.
2. Click **Scarica video** below the player.
3. The browser download manager saves the lesson as `<page title>.mp4`.

If the message says the video session is not available, start the video for a
few seconds and click again — the player's request contains the session the
extension needs.

## How it works

- `src/lib.js` — URL/entry parsing, flavor selection, filename cleanup.
- `src/content.js` — adds the button and collects the entry ID / media URL
  from the lesson page (including same-origin player-bridge frames).
- `src/background.js` — resolves the partner, gets a Kaltura session, picks the
  best MP4 flavor, verifies it is a video, and calls `downloads.download`.
- `src/content.css` — button styling.

## Limits

- It only appears on Moodle `mod_kalvidres` pages under `*.unipd.it`.
- It downloads an already-transcoded MP4 flavor. DRM-protected or HLS-only
  entries are not decrypted or remuxed.
- You still need to be logged in to Moodle with access to the lesson.
- Downloading course material may be restricted by your university's policies;
  use it only where you are allowed to keep a copy.
- `dist/` is not committed. The built files are published as release assets.

## Test

```sh
node test/lib.test.js
```
