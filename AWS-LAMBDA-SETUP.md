# Remotion Lambda Setup (fast cloud video rendering)

This is the **one part only you can do** — it runs under your AWS account. ~20 min.
Everything else (render code, app wiring) is already built. After this, V3 videos
render on AWS Lambda in ~1-2 min and scale to many concurrent users; the app
auto-prefers Lambda when these env vars are set, and falls back to the VPS if not.

---

## Step 1 — Create an IAM user for Remotion (AWS Console)

1. AWS Console → **IAM** → **Users** → **Create user**. Name: `remotion-lambda`.
   Do NOT enable console access (programmatic only).
2. On permissions, choose **Attach policies directly** → **Create policy** →
   **JSON** tab, and paste the official Remotion policy from:
   https://www.remotion.dev/docs/lambda/permissions
   (Copy the full "user permissions" JSON there — it's long and Remotion keeps it
   current. Name the policy `remotion-lambda-policy`.)
3. Back on the user, attach `remotion-lambda-policy`. Create the user.

## Step 2 — Get access keys

1. Open the `remotion-lambda` user → **Security credentials** → **Create access key**
   → "Application running outside AWS" → Create.
2. Copy the **Access key ID** and **Secret access key** (you only see the secret once).

## Step 3 — Deploy the function + site (your machine)

From the repo's `remotion/` folder, set the keys and run the deploy script:

**PowerShell (Windows):**
```powershell
cd "C:\dev\1 - PrismGraphs\remotion"
$env:REMOTION_AWS_ACCESS_KEY_ID="AKIA...your key..."
$env:REMOTION_AWS_SECRET_ACCESS_KEY="...your secret..."
$env:AWS_REGION="us-east-1"
node scripts/deploy-lambda.mjs
```

It prints three values when done:
```
REMOTION_LAMBDA_FUNCTION=remotion-render-4-0-290-mem2048mb-disk2048mb-120sec
REMOTION_SERVE_URL=https://...s3...amazonaws.com/sites/docs2video-v3/index.html
REMOTION_AWS_REGION=us-east-1
```

## Step 4 — Add env vars to the app (Vercel)

In Vercel → your project → **Settings → Environment Variables**, add (Production):

| Name | Value |
|------|-------|
| `REMOTION_LAMBDA_FUNCTION` | (from step 3) |
| `REMOTION_SERVE_URL` | (from step 3) |
| `REMOTION_AWS_REGION` | `us-east-1` |
| `REMOTION_AWS_ACCESS_KEY_ID` | your access key |
| `REMOTION_AWS_SECRET_ACCESS_KEY` | your secret |

Redeploy (Vercel does this automatically on env change, or trigger a redeploy).

## Step 5 — Done

With those env vars set, the app **auto-uses Lambda** for V3 videos (it checks
`isLambdaConfigured()`). No flag to flip. If the vars are ever removed, it falls
back to the VPS path automatically.

Generate a video — it should complete in ~1-2 min instead of 5-10.

---

## Updating the visuals later

Any time you change `remotion/src` (new effects, etc.), re-publish the site so
Lambda renders the new look:
```powershell
cd "C:\dev\1 - PrismGraphs\remotion"
$env:REMOTION_AWS_ACCESS_KEY_ID="..."; $env:REMOTION_AWS_SECRET_ACCESS_KEY="..."
node scripts/deploy-lambda.mjs    # re-runs deploySite; serveUrl stays the same
```

## Cost
~$0.01–0.05 per video (Lambda compute + a little S3). No idle cost — you only pay
when rendering. Far cheaper than a always-on big VPS once volume is low/spiky.

## Security note
The IAM user has only the Remotion policy (least privilege). Rotate its keys if
ever exposed (IAM → user → Security credentials → deactivate old, create new,
update Vercel).
