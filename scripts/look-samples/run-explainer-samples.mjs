/**
 * ONE REAL SAMPLE PER VIDEO LOOK, from the route a new customer's video takes
 * (app/_lib/explainer-look.ts → explainer-engine.ts): the explainer engine on
 * the One Dollar Decks render worker, designing from the look's own sample
 * page (public/style-samples/kit-<look>-data.png), matched faithfully (no
 * direction), no brand. The made-up story in story.json; no database row.
 *
 *   node scripts/look-samples/run-explainer-samples.mjs <outDir> [look …]
 *
 * Reads RENDER_* from .env.local (never printed). Writes <outDir>/<look>/film.mp4 + poster.jpg.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs'

const ROOT = resolve(import.meta.dirname, '..', '..')
const env = Object.fromEntries(readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '').trim()] }))
const auth = { region: env.RENDER_AWS_REGION || 'us-east-1', credentials: { accessKeyId: env.RENDER_AWS_ACCESS_KEY_ID, secretAccessKey: env.RENDER_AWS_SECRET_ACCESS_KEY } }
const s3 = new S3Client(auth), ecs = new ECSClient(auth), Bucket = env.RENDER_BUCKET
const [out, ...pick] = process.argv.slice(2)
const LOOKS = pick.length ? pick : ['animated-slides', 'editorial', 'bright']
const story = JSON.parse(readFileSync(join(ROOT, 'scripts/look-samples/story.json'), 'utf8'))

async function one(look) {
  const id = `${new Date().toISOString().slice(0, 10)}-s${look.slice(0, 4)}${randomUUID().slice(0, 5)}`
  const job = { kind: 'explainer', title: story.title, scenes: story.scenes, palette: [], voiceId: story.voiceId, music: true, reference: true, logo: false, ds: {}, pages: [] }
  await s3.send(new PutObjectCommand({ Bucket, Key: `jobs/${id}/assets/reference.png`, Body: readFileSync(join(ROOT, `public/style-samples/kit-${look}-data.png`)), ContentType: 'image/png' }))
  await s3.send(new PutObjectCommand({ Bucket, Key: `jobs/${id}/job.json`, Body: JSON.stringify(job), ContentType: 'application/json' }))
  const r = await ecs.send(new RunTaskCommand({
    cluster: 'decks-render', taskDefinition: 'decks-render', launchType: 'FARGATE', count: 1,
    networkConfiguration: { awsvpcConfiguration: { subnets: env.RENDER_SUBNETS.split(','), securityGroups: [env.RENDER_SECURITY_GROUP], assignPublicIp: 'ENABLED' } },
    overrides: { cpu: '8192', memory: '16384', containerOverrides: [{ name: 'render', environment: [{ name: 'JOB_ID', value: id }, { name: 'ROLE', value: 'job' }] }] },
  }))
  if (r.failures?.length || !r.tasks?.length) throw new Error(`${look}: not started`)
  console.log(`${look}: job ${id} started`)
  const t0 = Date.now()
  for (;;) {
    await new Promise((res) => setTimeout(res, 20_000))
    let s = null
    try { s = JSON.parse(await (await s3.send(new GetObjectCommand({ Bucket, Key: `jobs/${id}/status.json` }))).Body.transformToString()) } catch { /* not yet */ }
    if (s?.state === 'failed') throw new Error(`${look}: failed — ${s.error}`)
    if (Date.now() - t0 > 40 * 60_000) throw new Error(`${look}: timed out`)
    if (s?.state === 'done') {
      const dir = join(out, look); mkdirSync(dir, { recursive: true })
      for (const k of s.outputs) writeFileSync(join(dir, k.replace(/^out\//, '')), Buffer.from(await (await s3.send(new GetObjectCommand({ Bucket, Key: `jobs/${id}/${k}` }))).Body.transformToByteArray()))
      console.log(`${look}: done in ${Math.round((Date.now() - t0) / 1000)}s ${JSON.stringify({ seconds: s.seconds, claudeUsd: s.claudeUsd })}`)
      return
    }
  }
}

const results = await Promise.allSettled(LOOKS.map(one))
for (const [i, r] of results.entries()) if (r.status === 'rejected') console.log(`${LOOKS[i]}: ERROR ${r.reason?.message ?? r.reason}`)
