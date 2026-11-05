#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

node test/lib.test.js
rm -rf dist/firefox dist/chrome dist/*.zip # keep dist/signed
for browser in firefox chrome; do
  mkdir -p "dist/$browser"
  cp src/lib.js src/background.js src/content.js src/content.css "dist/$browser/"
  cp -r icons "dist/$browser/icons"
  cp "manifests/$browser.json" "dist/$browser/manifest.json"
done
(cd dist/firefox && zip -qr ../kalvidres-downloader-firefox.zip .)
(cd dist/chrome && zip -qr ../kalvidres-downloader-chrome.zip .)
echo "Built dist/firefox, dist/chrome and their zip files"
