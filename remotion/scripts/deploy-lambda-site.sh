#!/usr/bin/env bash
# Publish the Remotion Lambda site "docs2video" with ONLY the shared files that
# customer renders load from the bundle (sfx/ and music/ — see BUNDLED in
# src/lib/asset.ts). Everything per-video is uploaded per render by
# scripts/lambda-render.mjs.
#
# Why: remotion/public is a 2.5 GB scratch folder (old projects, client voice
# files, leftover dir-vo-*.mp3). The site is publicly readable, and a plain
# `sites create` published all of it — and slide videos then played those
# leftovers instead of their own voice (2026-10-08). Never deploy without this.
#
# Run from remotion/ with REMOTION_AWS_ACCESS_KEY_ID / _SECRET_ACCESS_KEY set.
set -euo pipefail
cd "$(dirname "$0")/.."
CLEAN=".lambda-public"
rm -rf "$CLEAN" && mkdir -p "$CLEAN"
cp -r public/sfx public/music "$CLEAN/"
echo "publishing with: $(ls "$CLEAN" | tr '\n' ' ')($(du -sh "$CLEAN" | cut -f1))"
npx remotion lambda sites create src/index.ts --site-name=docs2video --region=us-east-1 --public-dir="$CLEAN"
