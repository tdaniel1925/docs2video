# Renders on Remotion Lambda — deploy notes

Since 2026-09-03 every Remotion render on the VPS (V3 explainer, editorial, infographic,
commercial templates, DirectedVideo) goes through `remotion/scripts/lambda-render.mjs`
whenever `REMOTION_SERVE_URL` is set. Unset it and the old local render runs unchanged.

## What the Lambda script does
1. Finds the per-video files the props point at (and all of `public/<assetDir>` when the
   props carry `assetDir`), uploads them to the Remotion S3 bucket, and passes `assetBase`
   (a public URL prefix) in the props. Compositions resolve files through `src/lib/asset.ts`,
   so the same props render locally or on Lambda.
2. Starts the render on the biggest compatible function, polls progress and prints
   `Rendered frames N/TOTAL` (the VPS progress bar keeps working).
3. Downloads the MP4 to the same `out/` path the local render used.

## Server .env — add these (values are in PrismGraphs .env.local; never commit them)
```
REMOTION_AWS_ACCESS_KEY_ID=…
REMOTION_AWS_SECRET_ACCESS_KEY=…
REMOTION_AWS_REGION=us-east-1
REMOTION_SERVE_URL=https://remotionlambda-useast1-kffa4jj051.s3.us-east-1.amazonaws.com/sites/docs2video/index.html
# optional — defaults to the biggest deployed function
REMOTION_FUNCTION_NAME=remotion-render-4-0-290-mem3008mb-disk2048mb-300sec
```

## Deploy
```
./redeploy.sh --no-cache     # package.json changed (adds @remotion/lambda) → rebuild deps
```
`redeploy.sh` now also copies `remotion/scripts/lambda-render.mjs` and `remotion/package.json`.

## When compositions change
The Lambda site bundle is a snapshot. After editing anything under `remotion/src` or the
bundled `public/` folders, redeploy it from a dev machine:
```
cd remotion && npx remotion lambda sites create src/index.ts --site-name=docs2video --region=us-east-1
```
(Needs the REMOTION_AWS_* keys in the shell.) The serve URL stays the same.

## Costs and speed (measured)
Restylez launch video, 60 s at 1080p: 97 s end to end, $0.027 compute. The VPS took ~10 min.

## Rollback
Remove `REMOTION_SERVE_URL` from the server .env and restart the container.
