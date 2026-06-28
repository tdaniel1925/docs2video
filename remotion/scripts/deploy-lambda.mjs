/**
 * Deploy the V3 Remotion engine to AWS Lambda for fast, parallel cloud rendering.
 *
 * What it does (idempotent — safe to re-run after code changes):
 *   1. deployFunction()  — the Lambda render function (or reuses the existing one)
 *   2. deploySite()      — bundles src/ and uploads it to an S3 bucket as the
 *                          "serve URL" Lambda renders from. Re-run after any
 *                          remotion/src change to publish new visuals.
 *
 * Prereqs (you do these — see AWS-LAMBDA-SETUP.md):
 *   - AWS account + an IAM user with the Remotion Lambda policy
 *   - These env vars set when you run this:
 *       REMOTION_AWS_ACCESS_KEY_ID, REMOTION_AWS_SECRET_ACCESS_KEY
 *   - Optional: AWS_REGION (defaults to us-east-1)
 *
 * Run:  node scripts/deploy-lambda.mjs
 * Then copy the printed FUNCTION_NAME + SERVE_URL into your app's env vars
 * (REMOTION_LAMBDA_FUNCTION, REMOTION_SERVE_URL).
 */
import { deployFunction, deploySite, getOrCreateBucket } from '@remotion/lambda'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const REGION = process.env.AWS_REGION || 'us-east-1'

// Lambda sizing: V3 renders are CPU-bound. More RAM = more vCPU = faster frames.
// 3008MB ≈ ~2 vCPU. Per-invocation TIMEOUT was 120s, which several chunk Lambdas
// blew through on heavy renders (confirmed in CloudWatch: "Task timed out after
// 120.06s" ×8) — that froze the whole render at ~44%. Raised to 300s (5 min, the
// Remotion-recommended ceiling) so a slow chunk finishes instead of being killed.
const RAM = 3008
const DISK = 2048
const TIMEOUT = 300

async function main() {
  if (!process.env.REMOTION_AWS_ACCESS_KEY_ID || !process.env.REMOTION_AWS_SECRET_ACCESS_KEY) {
    console.error('Missing REMOTION_AWS_ACCESS_KEY_ID / REMOTION_AWS_SECRET_ACCESS_KEY. See AWS-LAMBDA-SETUP.md.')
    process.exit(1)
  }

  console.log(`Region: ${REGION}`)
  console.log('1/3 Ensuring S3 bucket...')
  const { bucketName } = await getOrCreateBucket({ region: REGION })
  console.log(`    bucket: ${bucketName}`)

  console.log('2/3 Deploying Lambda function...')
  const { functionName } = await deployFunction({
    region: REGION,
    timeoutInSeconds: TIMEOUT,
    memorySizeInMb: RAM,
    diskSizeInMb: DISK,
    createCloudWatchLogGroup: true,
  })
  console.log(`    function: ${functionName}`)

  console.log('3/3 Bundling + deploying site (this can take a couple minutes)...')
  const { serveUrl } = await deploySite({
    region: REGION,
    bucketName,
    entryPoint: join(ROOT, 'src', 'index.ts'),
    siteName: 'docs2video-v3',
  })
  console.log(`    serveUrl: ${serveUrl}`)

  console.log('\n=== DONE — add these to your app env (Vercel) ===')
  console.log(`REMOTION_LAMBDA_FUNCTION=${functionName}`)
  console.log(`REMOTION_SERVE_URL=${serveUrl}`)
  console.log(`REMOTION_AWS_REGION=${REGION}`)
}
main().catch((e) => { console.error(e); process.exit(1) })
