#!/usr/bin/env bash
# clean_dedupe.sh — pure-shell alternative to sync_domains.py's Step 1-2
# (Python's load_and_clean()), for when you just want a clean, deduplicated
# domain list on disk without running any Python/DB code — e.g. to eyeball
# a feed before syncing it, or to feed some other tool.
#
# Strips AdBlock "||...^" wrapping and hosts-file "0.0.0.0 "/"127.0.0.1 "
# prefixes, drops comment/exception/cosmetic-filter lines, lowercases, and
# deduplicates via `sort -u` — the same dedup effect as Python's set(),
# just done as an OS pipeline instead of in-process.
#
# Usage: ./clean_dedupe.sh raw_feed.txt > clean_feed.txt

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <raw_feed_file>" >&2
  exit 1
fi

grep -vE '^\s*(#|!|;|\[|@@)' "$1" \
  | grep -v '##' \
  | sed -E 's/^\|\|([a-z0-9.-]+)\^.*$/\1/i' \
  | sed -E 's/^(0\.0\.0\.0|127\.0\.0\.1|::1?)[[:space:]]+//' \
  | sed -E 's/#.*$//' \
  | sed -E 's~^https?://~~i' \
  | sed -E 's~[/?:].*$~~' \
  | sed -E 's/^\*\.//' \
  | awk 'NF' \
  | tr '[:upper:]' '[:lower:]' \
  | grep -E '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' \
  | grep -vE '^[0-9]{1,3}(\.[0-9]{1,3}){3}$' \
  | sort -u
