#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

: "${WEB_EXT_API_KEY:?Set WEB_EXT_API_KEY or put it in .env}"
: "${WEB_EXT_API_SECRET:?Set WEB_EXT_API_SECRET or put it in .env}"

./build.sh
mkdir -p dist/signed

# web-ext reads WEB_EXT_API_KEY / WEB_EXT_API_SECRET from the environment (exported above)
npx --yes web-ext@10.8.0 sign \
  --source-dir dist/firefox \
  --artifacts-dir dist/signed \
  --channel unlisted

printf '\nSigned XPI:\n'
ls -1 dist/signed/*.xpi
