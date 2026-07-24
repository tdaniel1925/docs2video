// Build the Jordyn features INTERACTIVE HTML deck — full-screen click-through
// sections, manual advance (Next/arrows/dots), NO audio. Matches jordyn.app's
// warm cream/terracotta editorial look. Gemini spot illustrations base64-embedded.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url))
const J = join(HERE, '..', 'public', 'jordyn')
const ANIM = process.env.ANIMATED === '1' // rich-motion variant
const OUT = join(HERE, '..', 'out', ANIM ? 'jordyn-features-animated.html' : 'jordyn-features.html')
const illo = (k) => existsSync(join(J, `illo-${k}.png`)) ? 'data:image/png;base64,' + readFileSync(join(J, `illo-${k}.png`)).toString('base64') : ''
const KEYS = ['hero', 'step1', 'step2', 'step3', 'email', 'phone', 'paperwork', 'clients', 'pipeline', 'automation', 'invoice', 'booking', 'memory', 'voice', 'brain', 'security', 'integrations', 'pricing', 'cta']
const IMG = {}; for (const k of KEYS) IMG[k] = illo(k)

// 18 features from the site (title, one-line, illo key)
const FEATURES = [
  ['Morning briefing', 'Every inbox swept overnight: what needs you, who went quiet, and the expensive dates before they cost you.', 'email'],
  ['Self-building pipeline', 'Deals, decisions, and pending to-dos recorded automatically from your email — whatever your industry calls them.', 'pipeline'],
  ['A real email client, AI inside', 'Folders, drafts, archive, star — synced live with Gmail, Outlook & Fastmail. Plus replies drafted in your voice.', 'email'],
  ['Plain-English automations', '"Whenever an email arrives about the Chen file, update it and flag me." Say it once, it runs forever.', 'automation'],
  ['Built-in book of business', 'Import your spreadsheet or let Jordyn interview you. Every client with emails, files, and deals attached.', 'clients'],
  ['A brain that learns you', "Your industry's products, paperwork, and lingo on day one — plus a memory for how YOU work.", 'brain'],
  ['Get paid from one sentence', '"Invoice Chen $1,200" — a branded invoice with a pay-online button, sent through your own Stripe.', 'invoice'],
  ['Campaigns on autopilot', 'Playbooks write every touch for your approval, send on schedule, and stop the moment they reply.', 'automation'],
  ['Your own booking page', '"Make me a booking page" — a public link with your real availability. They pick, it books, both get confirmed.', 'booking'],
  ['An inbox that knows who matters', 'Opens to people you know — clients, contacts, real correspondents. Newsletters wait in their own tab.', 'email'],
  ['Nothing sends without you', 'Every email arrives as a draft card you edit directly — change a word, hit send. Until you do, nothing leaves.', 'security'],
  ['To-dos that file themselves', 'Jordyn spots the bills, deadlines, and promises in your inbox and files them — each linked to its email.', 'automation'],
  ['Paperwork, machine-verified', 'Exhibit packages, stamped and numbered, assembled from your files — checked page by page before you see them.', 'paperwork'],
  ['Every file, remembered', 'Every attachment is read, described, and matched to its people — so "find the signed W-9 from March" just works.', 'memory'],
  ['Say it, don’t type it', 'Dictate on any device — chat, email, contacts, events, to-dos. Every call transcribed, playable, shareable.', 'voice'],
  ['Get-paid dashboard', 'Coupons, payment links, refunds, and who-hasn’t-paid — all from chat, through your own Stripe.', 'invoice'],
  ['Client workspaces, automatic', 'Every client gets one page: their emails (from everyone at their company), files, and to-dos. Zero filing.', 'clients'],
  ['Writes your paperwork', 'Letters and PDFs on your letterhead, the documents your industry actually sends — matched to your tone.', 'paperwork'],
]

const INTEGRATIONS = ['Gmail', 'Outlook', 'Fastmail', 'Google Calendar', 'Google Drive', 'Dropbox', 'Microsoft Teams', 'LinkedIn', 'Stripe', 'Salesforce', 'HubSpot', 'Notion', 'Slack', 'Calendly', 'DocuSign', 'Brevo', 'Mailchimp', 'Zoom']
const CHANNELS = [
  ['Email', 'Jordyn works your inbox all day', 'email', ['Folders, drafts & filing — a real mail client', 'Synced live with Gmail, Outlook & Fastmail', 'Replies drafted in your voice; stalled work surfaced']],
  ['Phone', 'Answers your phone — and makes your calls', 'phone', ['A real local number, answering in your business’s name', 'Say who to call and why — Jordyn writes the script and dials', 'Every call summarized and filed; callbacks become tasks', '18¢ a minute. No plans, no seats, no separate provider']],
  ['Clients', 'A workspace for every client, built automatically', 'clients', ['Grouped by company domain — zero filing', '"Send me the proposal by Friday" becomes a task by itself', 'Files, calls, and history in one place']],
  ['Paperwork', 'Jordyn writes the paperwork', 'paperwork', ['PDFs & letters on your letterhead', 'Emails that sound like you wrote them', 'Campaigns that write themselves']],
]
const SECURITY = [
  ['No passwords, ever', 'Sign-in buttons in chat — no API keys in the open.'],
  ['Nothing sends without your OK', 'Every outbound action waits for one tap.'],
  ['Your data never trains AI', 'Your business stays yours. Full stop.'],
  ['SOC 2-certified infrastructure', 'Enterprise-grade, independently audited.'],
  ['Strict account isolation', 'Your firm’s data is walled off from everyone else’s.'],
  ['Leave cleanly, anytime', 'Export and go — no lock-in, no hostage data.'],
]
const PRICING = [
  ['Trial', '3 days', 'Free', ['Install your industry brain', 'Connect one email', 'Nothing sends without your OK'], false],
  ['Pro', 'per month', 'Everything', ['Email, phone & paperwork', 'Unlimited automations & campaigns', 'Your own Stripe invoicing', 'Booking pages & client workspaces'], true],
  ['Annual', 'best value', 'Save big', ['Everything in Pro', 'Priority support', 'One closed deal covers years of it'], false],
]

const HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Jordyn — Features</title><style>
:root{--cream:#faf9f5;--cream2:#f0eee6;--peach:#f5e6df;--ink:#3d3929;--mute:#6b6759;--faint:#9c988a;--rust:#c96442;--rust-d:#b0512f;--sage:#8a9a7b;--card:#fffdf8;--font:-apple-system,'Segoe UI',Roboto,'Helvetica Neue',system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%}
body{background:var(--cream);font-family:var(--font);color:var(--ink);overflow:hidden}
#app{position:relative;width:100vw;height:100vh}
/* padding-bottom (nav clearance) + overflow-auto so nothing hides under the nav
   or gets cut off the top; tall sections scroll internally instead of clipping. */
.sec{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(20px,4vh,48px) 6vw 104px;opacity:0;transform:translateY(24px);transition:opacity .55s ease,transform .55s cubic-bezier(.16,1,.3,1);pointer-events:none;z-index:2;overflow-y:auto;overflow-x:hidden}
.sec.on{opacity:1;transform:none;pointer-events:auto}
/* when content is taller than the viewport, top-align so the TOP is never cut off */
.sec{justify-content:safe center}
.sec::-webkit-scrollbar{width:8px}.sec::-webkit-scrollbar-thumb{background:rgba(61,57,41,.18);border-radius:4px}
.wrap{width:100%;max-width:1240px;margin:0 auto}
.kick{display:inline-flex;align-items:center;gap:9px;font-weight:700;font-size:clamp(11px,1.1vw,15px);letter-spacing:.14em;text-transform:uppercase;color:var(--rust);margin-bottom:clamp(10px,1.6vh,16px)}
.kick .dot{width:7px;height:7px;border-radius:50%;background:var(--rust)}
h1{font-weight:800;font-size:clamp(34px,5.6vw,78px);line-height:1.03;letter-spacing:-.025em;color:var(--ink)}
h1 .r{color:var(--rust)}
h2{font-weight:800;font-size:clamp(24px,3.4vw,48px);line-height:1.08;letter-spacing:-.02em}
.lead{font-weight:400;font-size:clamp(15px,1.7vw,24px);color:var(--mute);line-height:1.45;max-width:760px;margin-top:clamp(10px,1.4vh,16px)}
.lead .r{color:var(--rust);font-weight:600}
.foot{font-weight:500;font-size:clamp(13px,1.4vw,19px);color:var(--faint);margin-top:20px}
.pill{display:inline-flex;align-items:center;gap:8px;background:var(--peach);color:var(--rust-d);font-weight:600;font-size:clamp(12px,1.2vw,16px);padding:8px 16px;border-radius:9px;margin-bottom:18px}
.btn{display:inline-flex;align-items:center;gap:8px;background:var(--rust);color:#fff;font-weight:700;font-size:clamp(14px,1.5vw,19px);padding:14px 26px;border-radius:10px;box-shadow:0 8px 24px rgba(201,100,66,.28);margin-top:8px}
.brand{font-weight:800;font-size:clamp(22px,2.2vw,30px);color:var(--rust);letter-spacing:-.01em}
.brand .sm{color:var(--ink)}
/* hero split */
.hero{display:grid;grid-template-columns:1.15fr .85fr;gap:clamp(24px,4vw,60px);align-items:center}
.illo{background:var(--card);border:1px solid rgba(61,57,41,.08);border-radius:22px;overflow:hidden;box-shadow:0 24px 60px rgba(61,57,41,.10)}
.illo img{width:100%;height:100%;object-fit:cover;display:block}
.illo.big{aspect-ratio:1;max-height:min(56vh,520px);width:auto;max-width:100%;margin:0 auto}
/* 3-step */
.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(12px,1.6vw,24px);margin-top:clamp(16px,2.5vh,28px);width:100%}
.step{background:var(--card);border:1px solid rgba(61,57,41,.08);border-radius:18px;padding:clamp(14px,1.6vw,22px);box-shadow:0 12px 34px rgba(61,57,41,.07);text-align:left}
.step .n{width:28px;height:28px;border-radius:8px;background:var(--peach);color:var(--rust-d);font-weight:800;display:flex;align-items:center;justify-content:center;font-size:15px;margin-bottom:11px}
.step .si{height:clamp(74px,15vh,150px);border-radius:12px;overflow:hidden;margin-bottom:11px;background:var(--cream2)}
.step .si img{width:100%;height:100%;object-fit:cover}
.step .t{font-weight:800;font-size:clamp(16px,1.6vw,22px);margin-bottom:8px}
.step .d{font-weight:400;font-size:clamp(13px,1.25vw,17px);color:var(--mute);line-height:1.45}
/* feature grid */
.fhead{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:22px}
.fhead{margin-bottom:clamp(10px,1.6vh,18px)}
.fgrid{display:grid;grid-template-columns:repeat(6,1fr);gap:clamp(7px,.8vw,12px)}
.fcard{background:var(--card);border:1px solid rgba(61,57,41,.08);border-radius:13px;padding:8px;cursor:pointer;transition:transform .18s,box-shadow .18s,border-color .18s;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}
.fcard:hover{transform:translateY(-4px);box-shadow:0 14px 30px rgba(61,57,41,.12);border-color:rgba(201,100,66,.4)}
/* image height driven by viewport so all 3 rows fit above the nav */
.fcard .fi{width:auto;height:clamp(56px,11vh,120px);aspect-ratio:1;border-radius:10px;overflow:hidden;background:var(--cream2)}
.fcard .fi img{width:100%;height:100%;object-fit:cover}
.fcard .ft{font-weight:700;font-size:clamp(10px,.92vw,13px);line-height:1.18;color:var(--ink)}
/* detail overlay */
.detail{position:absolute;inset:0;z-index:20;display:none;align-items:center;justify-content:center;padding:6vh 6vw;background:rgba(61,57,41,.28);backdrop-filter:blur(3px)}
.detail.show{display:flex}
.dcard{background:var(--card);border-radius:22px;max-width:920px;width:100%;display:grid;grid-template-columns:1fr 1fr;overflow:hidden;box-shadow:0 40px 100px rgba(61,57,41,.3)}
.dcard .dimg{background:var(--cream2)}.dcard .dimg img{width:100%;height:100%;object-fit:cover;min-height:340px}
.dcard .dbody{padding:clamp(24px,3vw,44px);display:flex;flex-direction:column;justify-content:center;position:relative}
.dcard .dt{font-weight:800;font-size:clamp(24px,2.8vw,38px);letter-spacing:-.02em;margin-bottom:14px}
.dcard .dd{font-weight:400;font-size:clamp(15px,1.5vw,21px);color:var(--mute);line-height:1.55}
.dclose{position:absolute;top:16px;right:18px;width:38px;height:38px;border-radius:10px;border:none;background:var(--cream2);color:var(--ink);font-size:20px;cursor:pointer;font-weight:700}
.dclose:hover{background:var(--peach)}
/* channels */
.chan{display:grid;grid-template-columns:.9fr 1.1fr;gap:clamp(24px,4vw,56px);align-items:center;width:100%}
.chan .clist{list-style:none}.chan .clist li{display:flex;gap:12px;align-items:flex-start;font-weight:500;font-size:clamp(14px,1.5vw,21px);color:var(--ink);margin-bottom:14px;line-height:1.4}
.chan .clist li .ck{color:var(--rust);font-weight:800;flex:0 0 auto}
.chantabs{display:flex;gap:8px;margin-bottom:22px;flex-wrap:wrap}
.chantab{padding:9px 18px;border-radius:9px;border:1px solid rgba(61,57,41,.14);background:var(--card);font-weight:700;font-size:clamp(13px,1.3vw,17px);cursor:pointer;color:var(--mute);transition:all .18s}
.chantab.on{background:var(--rust);color:#fff;border-color:var(--rust)}
/* integrations marquee */
.marq{width:100%;overflow:hidden;margin-top:18px;-webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.marqrow{display:flex;gap:14px;width:max-content;animation:scroll 34s linear infinite}
.chipI{display:flex;align-items:center;gap:9px;background:var(--card);border:1px solid rgba(61,57,41,.1);border-radius:11px;padding:12px 20px;font-weight:600;font-size:clamp(14px,1.4vw,19px);color:var(--ink);white-space:nowrap}
.chipI .cd{width:10px;height:10px;border-radius:3px;background:var(--rust)}
@keyframes scroll{to{transform:translateX(-50%)}}
/* security grid */
.sgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(12px,1.6vw,22px);margin-top:26px;width:100%}
.scard{background:var(--card);border:1px solid rgba(61,57,41,.08);border-radius:16px;padding:clamp(16px,2vw,26px);box-shadow:0 10px 28px rgba(61,57,41,.06)}
.scard .sh{display:flex;align-items:center;gap:10px;font-weight:800;font-size:clamp(15px,1.5vw,21px);margin-bottom:10px}
.scard .sh .shield{width:26px;height:26px;border-radius:8px;background:var(--peach);color:var(--rust-d);display:flex;align-items:center;justify-content:center;font-size:14px}
.scard .sd{font-weight:400;font-size:clamp(13px,1.25vw,17px);color:var(--mute);line-height:1.45}
/* pricing */
.pgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(14px,2vw,26px);margin-top:28px;width:100%;align-items:stretch}
.pcard{background:var(--card);border:1px solid rgba(61,57,41,.1);border-radius:20px;padding:clamp(20px,2.4vw,34px);display:flex;flex-direction:column;box-shadow:0 14px 34px rgba(61,57,41,.07)}
.pcard.hot{border:2px solid var(--rust);box-shadow:0 24px 54px rgba(201,100,66,.22);transform:translateY(-8px)}
.pcard .pn{font-weight:800;font-size:clamp(19px,2vw,27px)}
.pcard .pp{font-weight:500;font-size:clamp(13px,1.3vw,17px);color:var(--faint);margin:4px 0 4px}
.pcard .pv{font-weight:800;font-size:clamp(24px,2.6vw,38px);color:var(--rust);margin-bottom:14px;letter-spacing:-.02em}
.pcard ul{list-style:none;margin-top:6px}.pcard li{display:flex;gap:9px;font-weight:500;font-size:clamp(13px,1.3vw,17px);color:var(--ink);margin-bottom:10px;line-height:1.35}
.pcard li .ck{color:var(--rust);font-weight:800}
.hotbadge{align-self:flex-start;background:var(--rust);color:#fff;font-weight:700;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:4px 12px;border-radius:7px;margin-bottom:12px}
/* reveal */
.reveal{opacity:0;transform:translateY(18px)}.on .reveal{animation:rv .55s cubic-bezier(.16,1,.3,1) forwards}
.on .reveal.d1{animation-delay:.08s}.on .reveal.d2{animation-delay:.16s}.on .reveal.d3{animation-delay:.24s}
@keyframes rv{to{opacity:1;transform:none}}
/* nav */
#bar{position:fixed;left:0;top:0;height:4px;background:var(--rust);width:0;z-index:40;transition:width .35s ease}
#nav{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;z-index:50;background:rgba(255,253,248,.92);border:1px solid rgba(61,57,41,.12);border-radius:999px;padding:7px 11px;backdrop-filter:blur(8px);box-shadow:0 8px 26px rgba(61,57,41,.12)}
#nav button{background:var(--cream2);border:none;color:var(--ink);font:inherit;font-weight:700;font-size:15px;height:40px;border-radius:20px;cursor:pointer;transition:all .18s;display:flex;align-items:center;justify-content:center;padding:0 17px;gap:7px}
#nav button.icon{width:40px;padding:0}#nav button:hover{background:var(--rust);color:#fff}
#dots{display:flex;gap:6px;margin:0 5px}#dots i{width:9px;height:9px;border-radius:50%;background:rgba(61,57,41,.2);cursor:pointer;transition:all .2s}#dots i.on{background:var(--rust);transform:scale(1.25)}
#nav .lab{font-size:12px;color:var(--faint);padding:0 8px;min-width:120px;text-align:center}
.tag{position:fixed;top:14px;left:20px;z-index:40;font-weight:800;font-size:19px;color:var(--rust)}.tag .sm{color:var(--ink)}
.hint{position:fixed;top:16px;right:20px;z-index:40;font-size:12px;color:var(--faint)}
@media(max-width:820px){.hero,.chan,.dcard{grid-template-columns:1fr}.fgrid{grid-template-columns:repeat(3,1fr)}.steps,.sgrid,.pgrid{grid-template-columns:1fr}}
${ANIM ? `/* ===== RICH MOTION LAYER (animated variant) ===== */
/* warm living gradient behind everything */
body.anim{background:var(--cream)}
body.anim #app::before{content:'';position:absolute;inset:0;z-index:0;pointer-events:none;
  background:radial-gradient(60% 55% at 18% 22%,rgba(201,100,66,.10),transparent 60%),radial-gradient(55% 60% at 85% 78%,rgba(138,154,123,.12),transparent 62%);
  animation:warmdrift 16s ease-in-out infinite alternate}
@keyframes warmdrift{from{transform:translate3d(-1.5%,-1%,0) scale(1.02)}to{transform:translate3d(2%,1.5%,0) scale(1.08)}}
/* staggered reveal: each direct child of .wrap animates in on its own beat */
body.anim .sec .wrap>*{opacity:0;transform:translateY(22px)}
body.anim .sec.on .wrap>*{animation:rvUp .62s cubic-bezier(.16,1,.3,1) forwards}
body.anim .sec.on .wrap>*:nth-child(1){animation-delay:.04s}
body.anim .sec.on .wrap>*:nth-child(2){animation-delay:.13s}
body.anim .sec.on .wrap>*:nth-child(3){animation-delay:.22s}
body.anim .sec.on .wrap>*:nth-child(4){animation-delay:.31s}
@keyframes rvUp{to{opacity:1;transform:none}}
/* grid/step children build in with a per-item stagger set via --i */
body.anim .fcard,body.anim .step,body.anim .scard,body.anim .pcard,body.anim .chipI{opacity:0;transform:translateY(16px) scale(.98)}
body.anim .sec.on .fcard,body.anim .sec.on .step,body.anim .sec.on .scard,body.anim .sec.on .pcard{animation:pop .5s cubic-bezier(.16,1,.3,1) forwards;animation-delay:calc(.18s + var(--i,0)*.045s)}
@keyframes pop{to{opacity:1;transform:none}}
/* the marquee chips fade in but keep their own scroll */
body.anim .sec.on .marqrow .chipI{opacity:1;transform:none}
/* illustration: slow ken-burns drift + a light sweep on entry */
body.anim .illo{position:relative}
body.anim .sec.on .illo.big img,body.anim .sec.on .step .si img,body.anim .sec.on #chan-illo img{animation:kb 14s ease-out forwards}
@keyframes kb{from{transform:scale(1.06) translateY(1%)}to{transform:scale(1.0) translateY(0)}}
body.anim .illo::after{content:'';position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.5) 50%,transparent 65%);transform:translateX(-120%)}
body.anim .sec.on .illo::after{animation:sweep 1.1s ease-out .35s}
@keyframes sweep{to{transform:translateX(120%)}}
/* hover tilt + lift on interactive cards */
body.anim .fcard{transition:transform .22s cubic-bezier(.16,1,.3,1),box-shadow .22s,border-color .18s}
body.anim .fcard:hover{transform:translateY(-6px) rotateZ(-.6deg) scale(1.03)}
body.anim .fcard:hover .fi img{transform:scale(1.08)}
body.anim .fcard .fi img{transition:transform .35s ease}
body.anim .scard,body.anim .pcard,body.anim .step{transition:transform .25s cubic-bezier(.16,1,.3,1),box-shadow .25s}
body.anim .scard:hover,body.anim .step:hover{transform:translateY(-5px)}
body.anim .pcard:hover{transform:translateY(-9px)}body.anim .pcard.hot:hover{transform:translateY(-14px)}
/* the little check/shield/step-number gets a pop */
body.anim .sec.on .step .n,body.anim .sec.on .scard .shield{animation:badgepop .5s cubic-bezier(.34,1.56,.64,1) both;animation-delay:.4s}
@keyframes badgepop{0%{transform:scale(.4);opacity:0}100%{transform:scale(1);opacity:1}}
/* pulsing kicker dot + accent underline that draws in on the h2 */
body.anim .kick .dot{animation:pulse 2s ease-in-out infinite}
@keyframes pulse{0%,100%{box-shadow:0 0 0 0 rgba(201,100,66,.5)}50%{box-shadow:0 0 0 6px rgba(201,100,66,0)}}
/* magnetic CTA button */
body.anim .btn{transition:transform .18s cubic-bezier(.16,1,.3,1),box-shadow .18s;will-change:transform}
body.anim .btn:hover{box-shadow:0 14px 34px rgba(201,100,66,.4)}
/* pill shimmer */
body.anim .pill{position:relative;overflow:hidden}
body.anim .sec.on .pill::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.6) 50%,transparent 60%);transform:translateX(-120%);animation:sweep 1.4s ease-out 1s}
@media(prefers-reduced-motion:reduce){body.anim *{animation-duration:.01ms!important;animation-iteration-count:1!important}}
` : ''}
</style></head><body class="${ANIM ? 'anim' : ''}">
<div id="bar"></div>
<div class="tag">Jordyn<span class="sm">.</span></div><div class="hint">Interactive · click ‹ › or arrow keys</div>
<div id="app"></div>
<div class="detail" id="detail"><div class="dcard"><div class="dimg"><img id="d-img"></div><div class="dbody"><button class="dclose" id="d-close">×</button><div class="dt" id="d-t"></div><div class="dd" id="d-d"></div></div></div></div>
<div id="nav"><button class="icon" id="prev">‹</button><span class="lab" id="lab"></span><button id="next">Next ›</button><div id="dots"></div></div>
<script>
const IMG=${JSON.stringify(IMG)};
const FEATURES=${JSON.stringify(FEATURES)};
const INTEGRATIONS=${JSON.stringify(INTEGRATIONS)};
const CHANNELS=${JSON.stringify(CHANNELS)};
const SECURITY=${JSON.stringify(SECURITY)};
const PRICING=${JSON.stringify(PRICING)};
const img=k=>IMG[k]||'';

const SECTIONS=[
 {name:'Meet Jordyn',html:()=>\`<div class="wrap hero"><div><div class="pill reveal">★ NEW — Jordyn answers your phone and makes your calls</div><h1 class="reveal d1">Any AI can check your email. <span class="r">Jordyn runs it.</span></h1><div class="lead reveal d2">Replies drafted in your voice, sent with one tap. Mail filed, promos silenced, bills turned into to-dos, stalled deals chased until they answer. Then hand over the documents, the phone, the campaigns.</div><div class="btn reveal d3">Start free — install Jordyn's brain →</div><div class="foot reveal d3">3-day free trial · Nothing sends without your OK</div></div><div class="illo big reveal d2"><img src="\${img('hero')}"></div></div>\`},
 {name:'Not another chatbot',html:()=>\`<div class="wrap" style="text-align:center"><div class="kick reveal"><span class="dot"></span>Only on Jordyn</div><h2 class="reveal d1">ChatGPT assumes you're an AI expert.<br><span style="color:var(--rust)">Jordyn assumes you have a business to run.</span></h2><div class="lead reveal d2" style="margin:16px auto 0">No blank text box, no prompt engineering, nothing to learn. Jordyn's brain comes pre-loaded with your industry — and gets personal from there.</div><div class="steps reveal d2">\${[['1','Tell Jordyn your business','One question at signup: what industry are you in? Insurance, real estate, law, HVAC — type anything.','step1'],['2','Jordyn\\'s brain installs in seconds','Watch it build: the vocabulary, the workflows, the paperwork, the key players. It arrives speaking your language.','step2'],['3','Then Jordyn learns YOU','Connect your email and Jordyn studies your clients, your deals, your voice. Fluent on day one; yours by week one.','step3']].map(s=>\`<div class="step"><div class="si"><img src="\${img(s[3])}"></div><div class="n">\${s[0]}</div><div class="t">\${s[1]}</div><div class="d">\${s[2]}</div></div>\`).join('')}</div></div>\`},
 {name:'18 features',init:'grid',html:()=>\`<div class="wrap"><div class="fhead"><div><div class="kick reveal"><span class="dot"></span>Everything between you and your next closed deal</div><h2 class="reveal d1">One assistant. <span style="color:var(--rust)">Eighteen jobs done.</span></h2></div><div class="lead reveal d1" style="font-size:clamp(13px,1.3vw,18px);max-width:340px">👆 Click any card for the detail.</div></div><div class="fgrid reveal d2" id="fgrid"></div></div>\`},
 {name:'Email · Phone · Paperwork',init:'chan',html:()=>\`<div class="wrap"><div class="kick reveal"><span class="dot"></span>Email. Phone. Paperwork. Handled.</div><h2 class="reveal d1" style="margin-bottom:8px">The channels every business runs on.</h2><div class="chantabs reveal d1" id="chantabs"></div><div class="chan reveal d2"><div class="illo" id="chan-illo" style="aspect-ratio:1;max-height:52vh"></div><div><h2 id="chan-h" style="font-size:clamp(22px,2.6vw,38px);margin-bottom:18px"></h2><ul class="clist" id="chan-list"></ul></div></div></div>\`},
 {name:'Swappable brain',html:()=>\`<div class="wrap hero"><div class="illo big reveal d2"><img src="\${img('brain')}"></div><div><div class="kick reveal"><span class="dot"></span>Only on Jordyn</div><h2 class="reveal d1">The secret is Jordyn's <span style="color:var(--rust)">swappable brain.</span></h2><div class="lead reveal d2">Jordyn separates the <b>doing</b> from the <b>knowing</b>. The doing — email, pipeline, campaigns, deadlines — is world-class for everyone. The knowing installs the moment you sign up: your industry's expertise, packaged.</div><ul class="clist reveal d3" style="margin-top:18px;list-style:none">\${[['Expertise, packaged','the vocabulary, workflows & unwritten rules'],['Every industry, one assistant','popular fields deep-tuned; anything else built on the spot'],['Custom brains for firms','a private brain trained on how your shop runs']].map(x=>\`<li style="display:flex;gap:11px;margin-bottom:12px;font-size:clamp(14px,1.4vw,19px)"><span class="ck" style="color:var(--rust);font-weight:800">✓</span><span><b>\${x[0]}</b> — <span style="color:var(--mute)">\${x[1]}</span></span></li>\`).join('')}</ul></div></div>\`},
 {name:'Integrations',init:'marq',html:()=>\`<div class="wrap" style="text-align:center"><div class="kick reveal" style="justify-content:center"><span class="dot"></span>Connects with the tools you already use — and 500+ more</div><h2 class="reveal d1">At home in Microsoft 365 &amp; Google Workspace.</h2><div class="lead reveal d2" style="margin:14px auto 0">Say "connect my Dropbox" and Jordyn hands you a sign-in button right in chat. No setup screens, no API keys in the open.</div><div class="marq reveal d2"><div class="marqrow" id="marq1"></div></div><div class="marq reveal d2" style="margin-top:14px"><div class="marqrow" id="marq2" style="animation-duration:40s;animation-direction:reverse"></div></div></div>\`},
 {name:'Security',html:()=>\`<div class="wrap" style="text-align:center"><div class="kick reveal" style="justify-content:center"><span class="dot"></span>You're trusting Jordyn with your email. We take that personally.</div><h2 class="reveal d1">Built to be trusted with the keys.</h2><div class="sgrid reveal d2">\${SECURITY.map(s=>\`<div class="scard" style="text-align:left"><div class="sh"><span class="shield">🛡</span>\${s[0]}</div><div class="sd">\${s[1]}</div></div>\`).join('')}</div></div>\`},
 {name:'Pricing',html:()=>\`<div class="wrap" style="text-align:center"><div class="kick reveal" style="justify-content:center"><span class="dot"></span>One closed deal covers years of it</div><h2 class="reveal d1">Simple pricing. <span style="color:var(--rust)">Start free.</span></h2><div class="pgrid reveal d2">\${PRICING.map(p=>\`<div class="pcard \${p[4]?'hot':''}">\${p[4]?'<div class="hotbadge">Most popular</div>':''}<div class="pn">\${p[0]}</div><div class="pp">\${p[1]}</div><div class="pv">\${p[2]}</div><ul>\${p[3].map(f=>\`<li><span class="ck">✓</span>\${f}</li>\`).join('')}</ul></div>\`).join('')}</div><div class="foot reveal d3">3-day free trial · Nothing sends without your OK</div></div>\`},
 {name:'Get started',html:()=>\`<div class="wrap hero"><div><div class="brand reveal">Jordyn<span class="sm">.</span></div><h1 class="reveal d1" style="margin-top:14px">Spend your day on <span class="r">the work only you can do.</span></h1><div class="lead reveal d2">Your whole firm, one private brain. Install yours in seconds — Jordyn arrives already speaking your business.</div><div class="btn reveal d3">Open Jordyn →</div><div class="foot reveal d3">jordyn.app</div></div><div class="illo big reveal d2"><img src="\${img('cta')}"></div></div>\`},
];

const app=document.getElementById('app');
SECTIONS.forEach((s,i)=>{const d=document.createElement('div');d.className='sec';d.dataset.i=i;d.innerHTML=s.html();app.appendChild(d);});
const secs=[...document.querySelectorAll('.sec')];
const dots=document.getElementById('dots');SECTIONS.forEach((s,i)=>{const b=document.createElement('i');b.onclick=()=>go(i);dots.appendChild(b);});
const dotEls=[...dots.children],bar=document.getElementById('bar'),lab=document.getElementById('lab');
let cur=-1;

// feature grid + detail overlay
const detail=document.getElementById('detail');
function openDetail(f){document.getElementById('d-img').src=img(f[2]);document.getElementById('d-t').textContent=f[0];document.getElementById('d-d').textContent=f[1];detail.classList.add('show');}
function closeDetail(){detail.classList.remove('show');}
document.getElementById('d-close').onclick=closeDetail;
detail.onclick=e=>{if(e.target===detail)closeDetail();};
function initGrid(sec){const g=sec.querySelector('#fgrid');if(g.dataset.done)return;g.dataset.done=1;
  FEATURES.forEach(f=>{const c=document.createElement('div');c.className='fcard';c.innerHTML='<div class="fi"><img src="'+img(f[2])+'"></div><div class="ft">'+f[0]+'</div>';c.onclick=()=>openDetail(f);g.appendChild(c);});}

// channels tabs
function initChan(sec){const tabs=sec.querySelector('#chantabs');if(tabs.dataset.done)return;tabs.dataset.done=1;
  CHANNELS.forEach((c,i)=>{const t=document.createElement('div');t.className='chantab'+(i===0?' on':'');t.textContent=c[0];t.onclick=()=>selChan(sec,i);tabs.appendChild(t);});
  selChan(sec,0);}
function selChan(sec,i){[...sec.querySelectorAll('.chantab')].forEach((t,k)=>t.classList.toggle('on',k===i));
  const c=CHANNELS[i];sec.querySelector('#chan-illo').innerHTML='<img src="'+img(c[2])+'" style="width:100%;height:100%;object-fit:cover">';
  sec.querySelector('#chan-h').textContent=c[1];
  sec.querySelector('#chan-list').innerHTML=c[3].map(li=>'<li><span class="ck">✓</span>'+li+'</li>').join('');}

// integrations marquee
function initMarq(sec){const a=sec.querySelector('#marq1'),b=sec.querySelector('#marq2');if(a.dataset.done)return;a.dataset.done=1;
  const half=INTEGRATIONS.slice(0,9),half2=INTEGRATIONS.slice(9);
  const chip=n=>'<div class="chipI"><span class="cd"></span>'+n+'</div>';
  a.innerHTML=(half.map(chip).join('')).repeat(2);b.innerHTML=(half2.map(chip).join('')).repeat(2);}

const INITS={grid:initGrid,chan:initChan,marq:initMarq};

function go(i){
  if(i<0)i=0;if(i>=secs.length)i=secs.length-1;cur=i;closeDetail();
  secs.forEach(s=>s.classList.remove('on'));dotEls.forEach(d=>d.classList.remove('on'));
  const sec=secs[i];sec.classList.add('on');dotEls[i].classList.add('on');
  lab.textContent=(i+1)+' / '+secs.length+' · '+SECTIONS[i].name;
  bar.style.width=(i/(secs.length-1)*100)+'%';
  const conf=SECTIONS[i];if(INITS[conf.init])INITS[conf.init](sec);
  ${ANIM ? `stagger(sec);` : ''}
  document.getElementById('next').textContent=(i===secs.length-1?'Restart ↻':'Next ›');
}
${ANIM ? `
// assign per-item stagger indices so grids build in sequence, and re-trigger reveal
function stagger(sec){
  ['.fcard','.step','.scard','.pcard'].forEach(sel=>{
    sec.querySelectorAll(sel).forEach((el,k)=>{el.style.setProperty('--i',k);});
  });
  // restart entry animations by forcing reflow on the freshly-shown section
  sec.querySelectorAll('.wrap>*, .fcard,.step,.scard,.pcard,.illo').forEach(el=>{
    el.style.animation='none';void el.offsetWidth;el.style.animation='';
  });
}
// magnetic CTA buttons — follow the cursor slightly
function magnetize(){document.querySelectorAll('.btn').forEach(b=>{
  b.addEventListener('mousemove',e=>{const r=b.getBoundingClientRect();const x=e.clientX-r.left-r.width/2,y=e.clientY-r.top-r.height/2;b.style.transform='translate('+(x*.25)+'px,'+(y*.35)+'px)';});
  b.addEventListener('mouseleave',()=>{b.style.transform='';});
});}
magnetize();
` : ''}
document.getElementById('next').onclick=()=>{if(cur>=secs.length-1)go(0);else go(cur+1);};
document.getElementById('prev').onclick=()=>go(cur-1);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDetail();
  if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();if(detail.classList.contains('show'))return;if(cur>=secs.length-1)go(0);else go(cur+1);}
  if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();if(detail.classList.contains('show'))return;go(cur-1);}});
go(0);
</script></body></html>`

writeFileSync(OUT, HTML)
console.log('[build] wrote', OUT, '(' + Math.round(Buffer.byteLength(HTML) / 1024) + ' KB)')
