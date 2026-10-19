import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs'
import { isAdminDB } from './admin'
import { isVideoTemplate, type TemplateColors, type VideoTemplateId } from './video-templates'
import type { TemplateIdentity } from './template-identity'

/**
 * THE EXPLAINER ENGINE — the code-drawn explainer (built in One Dollar Decks'
 * engine, rendered on its AWS render worker) making Docs2Video's videos.
 * Founder, 2026-10-17: "deprecate the current engine … I like the explainer
 * we have in this app better."
 *
 * Docs2Video keeps everything it has around a video — the story step, credits,
 * refunds, the progress screen, sending, the watch page. Only the making moves:
 * this sends the APPROVED scenes (the user's own narration, opener and closing)
 * with the brand to the render worker, which designs every scene in the brand,
 * films it with that narration, saves the MP4 to the `videos` bucket and marks
 * the row completed — exactly as the old render service did, so nothing that
 * reads the row changes.
 *
 * WHO GETS IT (EXPLAINER_ENGINE):
 *   off (or unset)  nobody — the old engine makes every video
 *   admins          admins only, while it is proved on real documents
 *   on              everyone — the old engine makes no new videos
 */
export type ExplainerMode = 'off' | 'admins' | 'on'
export const explainerMode = (): ExplainerMode => {
  const v = String(process.env.EXPLAINER_ENGINE || '').toLowerCase()
  return v === 'on' || v === 'admins' ? v : 'off'
}
export async function explainerEngineFor(userId: string): Promise<boolean> {
  const mode = explainerMode()
  if (mode === 'on') return explainerConfigured()
  if (mode === 'admins') return explainerConfigured() && (await isAdminDB(userId).catch(() => false))
  return false
}

const cfg = () => ({
  region: process.env.RENDER_AWS_REGION || 'us-east-1',
  bucket: process.env.RENDER_BUCKET || '',
  subnets: (process.env.RENDER_SUBNETS || '').split(',').filter(Boolean),
  securityGroup: process.env.RENDER_SECURITY_GROUP || '',
  accessKeyId: process.env.RENDER_AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.RENDER_AWS_SECRET_ACCESS_KEY || '',
})
export const explainerConfigured = () => { const c = cfg(); return Boolean(c.bucket && c.subnets.length && c.securityGroup && c.accessKeyId && c.secretAccessKey) }

/*
 * Docs2Video's six voices (their saved ids are the old OpenAI names) as the
 * ElevenLabs voices fal already speaks them with (app/_lib/fal-tts.ts
 * FAL_VOICE_MAP), by ElevenLabs' own ids — the render worker calls
 * ElevenLabs directly, with word timings, so the motion lands on the words.
 */
export const ELEVENLABS_VOICE: Record<string, string> = {
  nova: '21m00Tcm4TlvDq8ikWAM',    // Sarah → Rachel
  shimmer: 'EXAVITQu4vr4xnSDxMaL', // Emily → Sarah
  onyx: 'nPczCjzI2devNBz1zQrb',    // James → Brian
  echo: 'iP95p4xoKVk53GoZ742B',    // Michael → Chris
  alloy: 'SAz9YHcvj6GT2YYXdXww',   // Alex → River
  fable: 'JBFqnCBsd6RMkjVDRZzb',   // Oliver → George
}
export const elevenVoiceFor = (voiceId: unknown) => (typeof voiceId === 'string' && ELEVENLABS_VOICE[voiceId]) || ELEVENLABS_VOICE.nova

/** The starting look when the user gave no picture of their own (served from public/). */
export const DEFAULT_LOOK = '/explainer-looks/soft-startup.jpg'

export type ExplainerScene ={ role: 'cover' | 'content' | 'closing'; title: string; bullets: string[]; narration: string }

type SceneIn = { title?: string; narration?: string; slideData?: { headline?: string; bullets?: string[]; stats?: { label: string; value: string }[] } }

/** One approved scene as the engine draws it: its words on screen, and the voice-over as it will be said. */
export function sceneFor(role: ExplainerScene['role'], s: SceneIn, extra: string[] = []): ExplainerScene {
  const sd = s.slideData ?? {}
  const stats = (sd.stats ?? []).filter((x) => x?.value).map((x) => `${x.value} ${x.label}`.trim())
  const bullets = [...stats, ...(sd.bullets ?? []), ...extra].map((b) => String(b).replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 6)
  return { role, title: (sd.headline || s.title || '').trim() || (role === 'closing' ? 'Thank you' : 'Untitled'), bullets, narration: String(s.narration ?? '').replace(/\s+/g, ' ').trim() }
}

/**
 * SEND THE VIDEO TO BE MADE. Throws when it cannot be started — the caller
 * then makes it the old way, so no video is ever lost to this.
 */
export async function startExplainer(o: {
  videoId: string; userId: string; title: string
  scenes: ExplainerScene[]
  palette: string[]
  logoUrl?: string | null
  referenceUrl?: string | null
  /**
   * A person's brand: who presents it, and where their photo goes ("Where my
   * photo appears"). The worker places assets/presenter.png on those scenes
   * (ODD render-worker/portrait.ts). Before this the photo never left here —
   * "no picture of Darrell on the opening or closing" (owner, 2026-10-18).
   */
  presenter?: { name: string; role?: string; cover: boolean; closing: boolean } | null
  photoUrl?: string | null
  voiceId?: string
  music: boolean
  /**
   * ONE OF THE FIXED TEMPLATES (video-templates.ts): the worker lays the
   * scenes out in it instead of copying a reference look, builds the cover
   * and closing from `identity` alone, and refuses any page that shows one
   * of `forbidden` (the account's own details on another person's video).
   */
  template?: VideoTemplateId | null
  identity?: TemplateIdentity | null
  forbidden?: string[]
  /**
   * The template's own colors, or the brand's: `templatePalette` is the CHOSEN
   * brand's main, second and accent color (brandTemplatePalette) — never the
   * account's, never a default. The worker makes them readable on every page.
   */
  templateColors?: TemplateColors
  templatePalette?: string[]
}): Promise<{ jobId: string }> {
  if (!explainerConfigured()) throw new Error('the explainer engine is not configured (RENDER_*)')
  const scenes = o.scenes.filter((s) => s.narration)
  if (scenes.length < 2) throw new Error('too few scenes with narration')
  const c = cfg()
  const auth = { region: c.region, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } }
  const s3 = new S3Client(auth)
  const jobId = `d2v-${o.videoId.slice(0, 8)}-${Date.now().toString(36)}`
  const put = (k: string, body: Buffer | string, type: string) => s3.send(new PutObjectCommand({ Bucket: c.bucket, Key: `jobs/${jobId}/${k}`, Body: body, ContentType: type }))
  const fetched = async (url?: string | null): Promise<Buffer | null> => {
    if (!url) return null
    try { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); return r.ok ? Buffer.from(await r.arrayBuffer()) : null } catch { return null }
  }
  /*
   * THE LOOK. The picture of the look they picked (explainer-look.ts: their
   * own picture, their free preview of the look, or the look's sample page),
   * matched faithfully with their brand colors as its accents. Only with no
   * picture at all: the default starting look (public/explainer-looks), pushed
   * a little (conservative). A board of their bare colors was tried first
   * (2026-10-17): every scene copied the board's blocks.
   */
  /* A template needs no reference look: its design is fixed. */
  const template = o.template && isVideoTemplate(o.template) ? o.template : null
  const own = template ? null : await fetched(o.referenceUrl)
  const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://docs2video.com').replace(/\/+$/, '')
  const wantsPhoto = !!(o.presenter && o.photoUrl && (o.presenter.cover || o.presenter.closing))
  const [logo, reference, photo] = await Promise.all([fetched(o.logoUrl), template ? Promise.resolve(null) : own ? Promise.resolve(own) : fetched(`${site}${DEFAULT_LOOK}`), wantsPhoto ? fetched(o.photoUrl) : Promise.resolve(null)])
  // A photo that was promised but cannot be fetched stops the video here (the
  // caller makes it the old way) rather than leaving it off silently.
  if (wantsPhoto && !photo) throw new Error('the presenter’s photo could not be fetched')
  // The brand's colors only when asked and the brand has some; else the template's own.
  const templatePalette = template && o.templateColors === 'brand' ? (o.templatePalette ?? []).filter((x) => /^#[0-9a-f]{6}$/i.test(x)).slice(0, 3) : []
  const job = {
    kind: 'explainer', title: o.title, scenes,
    palette: o.palette.filter((x) => /^#[0-9a-f]{6}$/i.test(x)).slice(0, 5),
    logo: Boolean(logo), reference: Boolean(reference),
    direction: own || template ? undefined : 'conservative',
    voiceId: elevenVoiceFor(o.voiceId), music: o.music,
    ...(o.presenter ? { presenter: { name: o.presenter.name, ...(o.presenter.role ? { role: o.presenter.role } : {}), photo: Boolean(photo), cover: o.presenter.cover, closing: o.presenter.closing } } : {}),
    ...(template ? {
      template,
      identity: { ...(o.identity ?? { kind: 'none' }), ...(photo ? {} : { photoOn: undefined }) },
      ...(o.forbidden?.length ? { forbidden: o.forbidden } : {}),
      ...(templatePalette.length ? { templateColors: 'brand' as const, templatePalette } : {}),
    } : {}),
    report: { kind: 'd2v', videoId: o.videoId, userId: o.userId },
    /* The worker's own fields for a film job, filled when the scenes are drawn. */
    ds: {}, pages: [],
  }
  await Promise.all([
    ...(logo ? [put('assets/logo.png', logo, 'image/png')] : []),
    ...(reference ? [put('assets/reference.png', reference, 'image/png')] : []),
    ...(photo ? [put('assets/presenter.png', photo, 'image/png')] : []),
  ])
  await put('job.json', JSON.stringify(job), 'application/json')
  const r = await new ECSClient(auth).send(new RunTaskCommand({
    cluster: 'decks-render', taskDefinition: 'decks-render', launchType: 'FARGATE', count: 1,
    networkConfiguration: { awsvpcConfiguration: { subnets: c.subnets, securityGroups: [c.securityGroup], assignPublicIp: 'ENABLED' } },
    overrides: { cpu: '8192', memory: '16384', containerOverrides: [{ name: 'render', environment: [{ name: 'JOB_ID', value: jobId }, { name: 'ROLE', value: 'job' }] }] },
  }))
  if (r.failures?.length || !r.tasks?.length) throw new Error(`the render worker did not start: ${r.failures?.map((f) => f.reason).join(', ') || 'no task'}`)
  return { jobId }
}

/**
 * A TEMPLATE'S FREE PREVIEW (template-preview.ts): the cover and first scene,
 * laid out in the template by the render worker (its `template-preview` job),
 * which puts the two pictures in this app's storage at the preview's place
 * and touches no video. A smaller machine than a film: two pages, at most one
 * photograph, no film.
 */
export async function startTemplatePreview(o: {
  userId: string; key: string; templateId: VideoTemplateId; title: string
  scenes: ExplainerScene[]; identity: TemplateIdentity; forbidden: string[]
  colors: TemplateColors; palette: string[]; pageCount: number
  logoUrl: string | null; photoUrl: string | null
  presenter: { name: string; role?: string; cover: boolean; closing: boolean } | null
}): Promise<{ jobId: string }> {
  if (!explainerConfigured()) throw new Error('the render worker is not configured (RENDER_*)')
  if (!isVideoTemplate(o.templateId)) throw new Error(`no template "${o.templateId}"`)
  if (!/^[a-f0-9]{32}$/.test(o.key)) throw new Error('bad preview key')
  const c = cfg()
  const auth = { region: c.region, credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } }
  const s3 = new S3Client(auth)
  const jobId = `d2v-pv-${o.key.slice(0, 8)}-${Date.now().toString(36)}`
  const put = (k: string, body: Buffer | string, type: string) => s3.send(new PutObjectCommand({ Bucket: c.bucket, Key: `jobs/${jobId}/${k}`, Body: body, ContentType: type }))
  const fetched = async (url?: string | null): Promise<Buffer | null> => {
    if (!url) return null
    try { const r = await fetch(url, { signal: AbortSignal.timeout(15000) }); return r.ok ? Buffer.from(await r.arrayBuffer()) : null } catch { return null }
  }
  const [logo, photo] = await Promise.all([fetched(o.logoUrl), fetched(o.photoUrl)])
  // A photo that was promised and will not load: the worker's check would refuse the cover without it.
  if (o.photoUrl && !photo) throw new Error('the presenter’s photo could not be fetched')
  const job = {
    kind: 'template-preview', title: o.title, scenes: o.scenes, template: o.templateId,
    preview: { kind: 'd2v-preview', userId: o.userId, key: o.key },
    identity: { ...o.identity, ...(photo ? {} : { photoOn: undefined }) },
    ...(o.forbidden.length ? { forbidden: o.forbidden } : {}),
    ...(o.colors === 'brand' && o.palette.length ? { templateColors: 'brand' as const, templatePalette: o.palette.slice(0, 3) } : {}),
    pageCount: o.pageCount,
    logo: Boolean(logo),
    ...(o.presenter ? { presenter: { name: o.presenter.name, ...(o.presenter.role ? { role: o.presenter.role } : {}), photo: Boolean(photo), cover: o.presenter.cover, closing: o.presenter.closing } } : {}),
    ds: {}, pages: [],
  }
  await Promise.all([
    ...(logo ? [put('assets/logo.png', logo, 'image/png')] : []),
    ...(photo ? [put('assets/presenter.png', photo, 'image/png')] : []),
  ])
  await put('job.json', JSON.stringify(job), 'application/json')
  const r = await new ECSClient(auth).send(new RunTaskCommand({
    cluster: 'decks-render', taskDefinition: 'decks-render', launchType: 'FARGATE', count: 1,
    networkConfiguration: { awsvpcConfiguration: { subnets: c.subnets, securityGroups: [c.securityGroup], assignPublicIp: 'ENABLED' } },
    overrides: { cpu: '4096', memory: '8192', containerOverrides: [{ name: 'render', environment: [{ name: 'JOB_ID', value: jobId }, { name: 'ROLE', value: 'job' }] }] },
  }))
  if (r.failures?.length || !r.tasks?.length) throw new Error(`the render worker did not start: ${r.failures?.map((f) => f.reason).join(', ') || 'no task'}`)
  return { jobId }
}
