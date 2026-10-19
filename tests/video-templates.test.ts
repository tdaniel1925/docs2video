import { describe, it, expect, vi, afterEach } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

/* The render worker's job, as S3 receives it (the S3 and ECS clients are stand-ins). */
const sent = vi.hoisted(() => ({ puts: new Map<string, string>(), tasks: 0 }))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send(c: { input: { Key: string; Body: unknown } }) { sent.puts.set(c.input.Key.replace(/^jobs\/[^/]+\//, ''), typeof c.input.Body === 'string' ? c.input.Body : '[bytes]'); return Promise.resolve({}) } },
  PutObjectCommand: class { input: unknown; constructor(i: unknown) { this.input = i } },
}))
vi.mock('@aws-sdk/client-ecs', () => ({
  ECSClient: class { send() { sent.tasks++; return Promise.resolve({ tasks: [{}], failures: [] }) } },
  RunTaskCommand: class { constructor(public input: unknown) {} },
}))
vi.mock('../app/_lib/admin', () => ({ isAdminDB: async () => false }))

import { VIDEO_TEMPLATES, VIDEO_TEMPLATE_IDS, isVideoTemplate, DEFAULT_VIDEO_TEMPLATE } from '../app/_lib/video-templates'
import { templateIdentity } from '../app/_lib/template-identity'
import { videoSender, foreignIdentity } from '../app/_lib/video-sender'
import { startExplainer, type ExplainerScene } from '../app/_lib/explainer-engine'

/* THE TEMPLATES (owner, 2026-10-18: "great templates users can choose from"), chosen on the Look step and made by the explainer engine. */
const ROOT = join(__dirname, '..')
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8')

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); sent.puts.clear(); sent.tasks = 0 })

describe('the eight templates', () => {
  it('are the engine’s eight, each with four sample scenes on disk', () => {
    expect([...VIDEO_TEMPLATE_IDS]).toEqual(['night', 'luxury', 'editorial', 'magazine', 'lifestyle', 'swiss', 'grunge', 'newsweekly'])
    for (const t of VIDEO_TEMPLATES) {
      expect(t.tagline.split(/\s+/).length, t.id).toBeLessThanOrEqual(3)
      expect(t.scenes).toHaveLength(4)
      for (const s of t.scenes) expect(existsSync(join(ROOT, 'public', s.src)), s.src).toBe(true)
    }
    expect(isVideoTemplate(DEFAULT_VIDEO_TEMPLATE)).toBe(true)
    expect(isVideoTemplate('time')).toBe(false)
  })
})

describe('who a template video is from — the chosen brand alone', () => {
  const trent = { full_name: 'Trent Daniel', company_name: 'Daniel Agency', email: 'trent@daniel.example', phone: '(555) 222-3333', calendly_url: 'https://cal.example/trent' }
  const darrell = { id: 'b1', name: 'Darrell Wolfe', profile_type: 'person' as const, person_role: 'Retirement Advisor', photo_url: 'https://x/d.jpg', brand_guide_data: { phone: '(555) 300-1000', email: 'darrell@wolfe.example', company: 'Wolfe Financial' } }
  it('Darrell’s brand on Trent’s account: Darrell everywhere, nothing of Trent’s — and Trent’s details refused on any page', () => {
    const s = videoSender(darrell, trent)
    const id = templateIdentity(s, { profile: trent, client: 'Jane', showContact: true, photoOn: { cover: true, closing: true } })
    expect(id).toEqual({ kind: 'person', person: 'Darrell Wolfe', role: 'Retirement Advisor', company: 'Wolfe Financial', client: 'Jane', phone: '(555) 300-1000', email: 'darrell@wolfe.example', showContact: true, photoOn: { cover: true, closing: true } })
    expect(JSON.stringify(id)).not.toMatch(/Trent|222-3333|trent@|cal\.example\/trent/)
    expect(foreignIdentity(s, trent)).toEqual(expect.arrayContaining(['Trent Daniel', 'trent@daniel.example', '(555) 222-3333']))
  })
  it('a company brand with no phone or email saved shows none — never the account’s (its booking link follows bookingFor)', () => {
    const id = templateIdentity(videoSender({ name: 'Avery & Co.', profile_type: 'company', brand_guide_data: {} }, trent), { profile: trent, showContact: true })
    expect(id).toEqual({ kind: 'company', company: 'Avery & Co.', showContact: true, booking: 'https://cal.example/trent' })
    expect(id).not.toHaveProperty('phone')
    expect(id).not.toHaveProperty('email')
  })
  it('no brand: the account’s own profile', () => {
    const id = templateIdentity(videoSender(null, trent), { profile: trent, showContact: true })
    expect(id).toMatchObject({ kind: 'person', person: 'Trent Daniel', company: 'Daniel Agency', phone: '(555) 222-3333', booking: 'https://cal.example/trent' })
  })
  it('a person who hides their name on slides is shown by their company; the photo only when it is sent', () => {
    const s = videoSender(darrell, trent)
    expect(templateIdentity(s, { showContact: false, hideName: true })).toMatchObject({ kind: 'company', company: 'Wolfe Financial' })
    expect(templateIdentity(s, { showContact: false, photoOn: null })).not.toHaveProperty('photoOn')
  })
})

describe('the template reaches the render worker', () => {
  const scenes: ExplainerScene[] = [
    { role: 'cover', title: 'Your plan', bullets: [], narration: 'Jane, Darrell has put this together.' },
    { role: 'content', title: 'Premium', bullets: ['$84.50 a month'], narration: 'Your premium went down.' },
    { role: 'closing', title: 'Let’s talk', bullets: [], narration: 'Call Darrell.' },
  ]
  const env = () => { for (const [k, v] of Object.entries({ RENDER_BUCKET: 'b', RENDER_SUBNETS: 's1', RENDER_SECURITY_GROUP: 'sg', RENDER_AWS_ACCESS_KEY_ID: 'k', RENDER_AWS_SECRET_ACCESS_KEY: 's' })) vi.stubEnv(k, v) }
  const fetchStub = () => vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })))

  it('the job names the template, who it is from and what must not appear — and sends no reference look', async () => {
    env(); fetchStub()
    const identity = { kind: 'person' as const, person: 'Darrell Wolfe', showContact: true, phone: '(555) 300-1000', photoOn: { cover: true, closing: true } }
    await startExplainer({ videoId: '2b7f0c4e-0000-4000-8000-000000000001', userId: '2b7f0c4e-0000-4000-8000-000000000002', title: 'T', scenes, palette: [], presenter: { name: 'Darrell Wolfe', cover: true, closing: true }, photoUrl: 'https://x/d.jpg', music: false, template: 'grunge', identity, forbidden: ['Trent Daniel'] })
    const job = JSON.parse(sent.puts.get('job.json')!)
    expect(job.template).toBe('grunge')
    expect(job.identity).toEqual(identity)
    expect(job.forbidden).toEqual(['Trent Daniel'])
    expect(job.reference).toBe(false)
    expect(job.presenter.photo).toBe(true)
    expect(sent.puts.has('assets/reference.png')).toBe(false)
    expect(sent.puts.has('assets/presenter.png')).toBe(true)
    expect(sent.tasks).toBe(1)
  })
  it('without a template the job is as before: a reference look, no template fields', async () => {
    env(); fetchStub()
    await startExplainer({ videoId: '2b7f0c4e-0000-4000-8000-000000000001', userId: '2b7f0c4e-0000-4000-8000-000000000002', title: 'T', scenes, palette: [], music: false })
    const job = JSON.parse(sent.puts.get('job.json')!)
    expect(job).not.toHaveProperty('template')
    expect(job).not.toHaveProperty('identity')
    expect(job.reference).toBe(true)
  })
  it('an unknown template is never sent', async () => {
    env(); fetchStub()
    await startExplainer({ videoId: '2b7f0c4e-0000-4000-8000-000000000001', userId: '2b7f0c4e-0000-4000-8000-000000000002', title: 'T', scenes, palette: [], music: false, template: 'time' as never })
    expect(JSON.parse(sent.puts.get('job.json')!)).not.toHaveProperty('template')
  })
})

describe('the choice travels from the Look step to the job', () => {
  it('the Look step saves it on the draft and sends it with Make it', () => {
    const look = read('app/(dashboard)/create/_components/steps/LookVoiceReview.tsx')
    // Saved on the draft, sent with Make it, and sent with the free preview (template-preview.ts).
    expect(look.match(/templateId: isVideo \? templateId : null/g)?.length).toBe(3)
    expect(look).toContain('<TemplatePicker')
    expect(look).not.toContain('<LookVsBrand')
    expect(look).toContain('<StepExplain step={part} />')
  })
  it('the draft keeps only one of the eight, or none; a look of your own clears it', () => {
    expect(read('app/api/videos/draft/route.ts')).toContain("if ('templateId' in u && !isVideoTemplate(u.templateId)) u.templateId = null")
    expect(read('app/api/look/route.ts')).toContain("kitLookCustom: look, templateId: null")
  })
  it('the route reads it, skips the reference look, and sends it with who the video is from', () => {
    const route = read('app/api/generate-video/route.ts')
    expect(route).toContain('const videoTemplateId: VideoTemplateId | null = isVideoTemplate((body as any).templateId)')
    expect(route).toMatch(/const picked = videoTemplateId\r?\n\s+\? \{ referenceUrl: null, source: 'template'/)
    expect(route).toMatch(/template: videoTemplateId,\r?\n\s+identity: templateIdentity\(sender, \{/)
    expect(route).toContain('forbidden: foreignNames,')
  })
})
