// Assemble the PREMIUM Apex comp HTML explainer into ONE self-contained .html:
// Gemini abstract-tech backdrops behind code-drawn charts + per-scene Rachel VO +
// ducked music, all base64-embedded. Auto-advances on each VO clip's real duration.
// Opens muted with a "Play with Sound" gate (browser autoplay rule).
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url))
const A = join(HERE, '..', 'public', 'htmlaudio')
const OUTFILE = join(HERE, '..', 'out', 'apex-comp-explainer-premium.html')
const durs = JSON.parse(readFileSync(join(A, 'durations.json'), 'utf8')).vo
const b64 = (p) => readFileSync(p).toString('base64')
const mp3 = (i) => 'data:audio/mpeg;base64,' + b64(join(A, `vo-${i}.mp3`))
const music = 'data:audio/mpeg;base64,' + b64(join(A, 'music.mp3'))
const png = (i) => 'data:image/png;base64,' + b64(join(A, `bd-${i}.png`))
const VOS = durs.map((_, i) => mp3(i))
const BDS = durs.map((_, i) => existsSync(join(A, `bd-${i}.png`)) ? png(i) : '')

const RANKS = [['Starter', 70], ['Bronze', 96], ['Silver', 122], ['Gold', 148], ['Platinum', 174], ['Ruby', 200], ['Diamond', 226], ['Crown', 252], ['Elite', 280]]
const SCHED = [
  ['Starter', '30%', '', '', '', '', '', ''], ['Bronze', '30%', '20%', '', '', '', '', ''], ['Silver', '30%', '20%', '18%', '', '', '', ''],
  ['Gold', '30%', '20%', '18%', '15%', '', '', ''], ['Platinum', '30%', '20%', '18%', '15%', '10%', '', ''], ['Ruby', '30%', '20%', '18%', '15%', '10%', '7%', ''],
  ['Diamond', '30%', '20%', '18%', '15%', '8%', '6%', '3%'], ['Crown', '30%', '22%', '18%', '13%', '8%', '6%', '3%'], ['Elite', '30%', '25%', '18%', '11%', '8%', '5%', '3%'],
]
const SCENES = [
  { name: 'Welcome', html: `<div class="badge">★ APEX · TECHNOLOGY PLAN</div><div class="brandcard">APEX <span class="g">AFFINITY GROUP</span></div><h1>The Compensation Plan</h1><div class="lead">A simple, honest walkthrough of how you get paid.</div>` },
  { name: 'What is B.V.', html: `<div class="kicker"><span class="star"></span>Key Term</div><h1>What Is <span class="hi">B.V.?</span></h1><div class="lead">For every product, Apex <span class="hi">designates a Business Volume</span> — the amount your commission is based on.</div><div class="foot">Docs2Video 9 → 122 BV · SmartViewz 69 BV · Lite 32 BV</div>` },
  { name: 'Two ways to earn', html: `<div class="kicker"><span class="star"></span>How You Get Paid</div><h1 style="margin-bottom:36px">You Earn <span class="hi">Two Ways.</span></h1><div class="twocol"><div class="card"><div class="t blue">You Sell</div><div class="s">commission on the B.V.<br>of what you sell</div></div><div class="plus">+</div><div class="card"><div class="t red">Team Sells</div><div class="s">override income as<br>your team sells too</div></div></div><div class="foot">Do both — your income <span style="color:#5fd39a">compounds.</span></div>` },
  { name: 'Nine ranks', html: `<div class="kicker"><span class="star"></span>Technology · 9 Ranks</div><h1 style="margin-bottom:26px">Climb From <span class="hi">Starter → Elite.</span></h1><div class="ladder" id="ladder"></div><div class="foot">Each rank has a target: personal volume + your team's group volume.</div>` },
  { name: 'Override schedule', html: `<div class="kicker"><span class="star"></span>The Override Schedule</div><h1 style="margin-bottom:22px">Earn <span class="hi">Deeper</span> As You Climb.</h1><div id="sched"></div><div class="foot">Level 1 is always 30%. At <span style="color:#5fd39a">Ruby & above</span>, you earn on the entire pool.</div>` },
  { name: 'Rank bonuses', html: `<div class="kicker"><span class="star"></span>One-Time Rank Bonuses</div><div class="big blue" data-count="93750" data-prefix="$">$0</div><div class="lead" style="margin-top:14px">in bonuses along the way — Starter → Elite.</div><div class="foot">Paid once per rank · illustrative</div>` },
  { name: 'Qualify', html: `<div class="kicker"><span class="star"></span>To Earn Overrides</div><div class="big green" data-count="50" data-suffix=" PV">0 PV</div><div class="lead" style="margin-top:14px">personal volume each month. Sell a little, <span class="hi">stay qualified.</span></div><div class="foot">Miss a month? A 30-day grace period. Your highest rank is permanent.</div>` },
  { name: 'Start', html: `<div class="brandcard">APEX <span class="g">AFFINITY GROUP</span></div><h1>Sell The Tools. <span class="hi">Build Your Team.</span></h1><div class="url">reachtheapex.net</div>` },
]

const HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Apex Technology Compensation Plan</title><style>
:root{--navy:#1e3a70;--navy-d:#132649;--red:#c0272d;--cream:#f4efe4;--green:#2f7d4f;--mute:#8fa0bd;--white:#fff;--font:'Archivo',-apple-system,'Segoe UI',Roboto,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%}
body{background:#0b1526;font-family:var(--font);color:#fff;overflow:hidden}
#stage{position:relative;width:100vw;height:100vh}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 6vw;text-align:center;opacity:0;transform:translateY(24px);transition:opacity .7s ease,transform .7s cubic-bezier(.16,1,.3,1);pointer-events:none;z-index:2}
.scene.active{opacity:1;transform:none}
.bd{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transform:scale(1.06);transition:opacity 1s ease,transform 7s ease-out;z-index:0}
.bd.active{opacity:1;transform:scale(1.14)}
.scrim{position:absolute;inset:0;z-index:1;background:radial-gradient(90% 80% at 50% 45%,rgba(11,21,38,.35),rgba(11,21,38,.82))}
.kicker{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:clamp(13px,1.4vw,20px);letter-spacing:.22em;text-transform:uppercase;color:#ff9d9d;margin-bottom:18px}
.kicker .star{width:16px;height:16px;background:var(--red);clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
h1{font-weight:900;font-size:clamp(34px,6vw,84px);line-height:1.02;letter-spacing:-.02em;text-shadow:0 4px 30px rgba(0,0,0,.6)}
h1 .hi{color:#ff8a8a}
.lead{font-weight:700;font-size:clamp(18px,2.6vw,40px);color:var(--cream);max-width:1100px;line-height:1.35;margin-top:10px;text-shadow:0 2px 20px rgba(0,0,0,.6)}
.lead .hi{color:#ffb3b3}
.foot{font-weight:600;font-size:clamp(14px,1.6vw,24px);color:#b9c6de;margin-top:26px}
.big{font-weight:900;font-size:clamp(60px,15vw,220px);line-height:.9;letter-spacing:-.03em;text-shadow:0 6px 40px rgba(0,0,0,.6)}
.blue{color:#8fbaff}.green{color:#5fd39a}.red{color:#ff7b80}
.twocol{display:flex;gap:clamp(16px,3vw,40px);align-items:stretch;flex-wrap:wrap;justify-content:center}
.card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:clamp(20px,3vw,40px);min-width:260px;box-shadow:0 20px 50px rgba(0,0,0,.4);backdrop-filter:blur(4px);opacity:0;transform:translateY(30px)}
.active .card{animation:pop .6s cubic-bezier(.16,1,.3,1) forwards}.active .card:nth-child(3){animation-delay:.15s}
@keyframes pop{to{opacity:1;transform:none}}
.card .t{font-weight:900;font-size:clamp(30px,4vw,64px)}.card .s{font-weight:700;font-size:clamp(14px,1.6vw,26px);color:var(--mute);margin-top:8px}
.plus{display:flex;align-items:center;font-weight:900;font-size:clamp(30px,4vw,60px);color:var(--mute)}
.ladder{display:flex;align-items:flex-end;gap:clamp(6px,1vw,16px);height:min(44vh,340px)}
.rung{display:flex;flex-direction:column;align-items:center;gap:8px;flex:1;opacity:0;transform:translateY(20px)}
.active .rung{animation:pop .5s cubic-bezier(.34,1.56,.64,1) forwards}
.rung .bar{width:100%;max-width:96px;border-radius:8px;background:linear-gradient(180deg,#2f5aa8,var(--navy));box-shadow:0 0 20px rgba(30,58,112,.5)}
.rung.top .bar{background:linear-gradient(180deg,#e0454b,var(--red));box-shadow:0 0 30px rgba(192,39,45,.6)}
.rung .lbl{font-weight:700;font-size:clamp(11px,1.1vw,19px);color:#cdd8ec}.rung.top .lbl{color:#ff8a8a}
table{border-collapse:separate;border-spacing:5px;font-size:clamp(12px,1.3vw,22px)}
th{color:var(--red);font-weight:800;padding:4px 8px}th.rank,td.rank{text-align:left;color:var(--cream);font-weight:800}
td{text-align:center;font-weight:700;padding:6px 10px;border-radius:7px;background:rgba(255,255,255,.06);color:#e8eefc;min-width:52px}
td.zero{color:#4b5a76;background:transparent;font-weight:400}td.l1{color:#8fbaff;background:rgba(30,58,112,.4)}
tr.top td:not(.zero){background:rgba(192,39,45,.22)}tr.top td.rank{color:#ff8a8a}
.badge{background:var(--red);border-radius:8px;padding:8px 20px;font-weight:800;letter-spacing:.2em;font-size:clamp(13px,1.4vw,22px);margin-bottom:22px}
.brandcard{background:#fff;color:var(--navy);border-radius:14px;padding:22px 44px;font-weight:900;font-size:clamp(28px,4vw,60px);letter-spacing:-.01em;box-shadow:0 24px 60px rgba(0,0,0,.5);margin-bottom:26px}
.brandcard .g{color:var(--red)}.url{font-weight:900;font-size:clamp(20px,2.4vw,40px);margin-top:22px}
#bar{position:fixed;left:0;top:0;height:4px;background:var(--red);width:0;z-index:40;transition:width .15s linear}
#ctl{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;z-index:50;background:rgba(11,21,38,.82);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:8px 12px;backdrop-filter:blur(8px)}
#ctl button{background:rgba(255,255,255,.1);border:none;color:#fff;font:inherit;font-weight:800;font-size:15px;width:42px;height:42px;border-radius:50%;cursor:pointer;transition:background .2s;display:flex;align-items:center;justify-content:center}
#ctl button:hover{background:var(--red)}#dots{display:flex;gap:7px;margin:0 8px}
#dots i{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.25);cursor:pointer;transition:all .2s}#dots i.on{background:var(--red);transform:scale(1.25)}
#ctl .label{font-size:13px;color:var(--mute);padding:0 8px;min-width:150px;text-align:center}
#gate{position:fixed;inset:0;z-index:100;background:radial-gradient(120% 100% at 50% 30%,var(--navy),var(--navy-d) 70%,#0b1526);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;cursor:pointer}
#gate .brandcard{cursor:default}
#playbig{background:var(--red);color:#fff;border:none;font:inherit;font-weight:900;font-size:26px;padding:20px 46px;border-radius:14px;cursor:pointer;box-shadow:0 20px 50px rgba(192,39,45,.4);display:flex;align-items:center;gap:14px;transition:transform .2s}
#playbig:hover{transform:scale(1.04)}
.gsub{color:#b9c6de;font-weight:600;font-size:18px}
</style></head><body>
<div id="bar"></div><div id="stage"></div>
<audio id="music" loop src="${music}"></audio>
<audio id="vo"></audio>
<div id="ctl" style="display:none"><button id="prev">‹</button><button id="play">❚❚</button><button id="next">›</button><div id="dots"></div><span class="label" id="label"></span></div>
<div id="gate"><div class="brandcard">APEX <span class="g">AFFINITY GROUP</span></div><div style="font-weight:900;font-size:44px;text-align:center">The Compensation Plan</div><button id="playbig">▶ &nbsp;Play With Sound</button><div class="gsub">Narrated · click anywhere to pause · use ‹ › or dots to skip</div></div>
<script>
const VOS=${JSON.stringify(VOS)};
const BDS=${JSON.stringify(BDS)};
const DURS=${JSON.stringify(durs)};
const SCENES=${JSON.stringify(SCENES)};
const RANKS=${JSON.stringify(RANKS)};
const SCHED=${JSON.stringify(SCHED)};
const stage=document.getElementById('stage');
SCENES.forEach((s,i)=>{
  const bd=document.createElement('div');bd.className='bd';bd.dataset.i=i;if(BDS[i])bd.style.backgroundImage='url('+BDS[i]+')';stage.appendChild(bd);
});
const scrim=document.createElement('div');scrim.className='scrim';stage.appendChild(scrim);
SCENES.forEach((s,i)=>{const d=document.createElement('div');d.className='scene';d.dataset.i=i;d.innerHTML=s.html;stage.appendChild(d);});
const scenes=[...document.querySelectorAll('.scene')],bds=[...document.querySelectorAll('.bd')];
const dots=document.getElementById('dots');SCENES.forEach((s,i)=>{const b=document.createElement('i');b.onclick=(e)=>{e.stopPropagation();go(i);};dots.appendChild(b);});
const dotEls=[...dots.children];
const bar=document.getElementById('bar'),label=document.getElementById('label'),playBtn=document.getElementById('play');
const musicEl=document.getElementById('music'),voEl=document.getElementById('vo');
let cur=-1,playing=true,t0=0,raf=null,started=false;
function buildLadder(el){el.innerHTML='';RANKS.forEach((r,i)=>{const d=document.createElement('div');d.className='rung'+(i===8?' top':'');d.style.animationDelay=(i*.05)+'s';d.innerHTML='<div class="bar" style="height:'+r[1]+'px"></div><div class="lbl">'+r[0]+'</div>';el.appendChild(d);});}
function buildSched(el){let h='<table><tr><th class="rank">RANK</th>'+['L1','L2','L3','L4','L5','L6','L7'].map(x=>'<th>'+x+'</th>').join('')+'</tr>';SCHED.forEach((row,r)=>{h+='<tr class="'+(r===8?'top':'')+'"><td class="rank">'+row[0]+'</td>'+row.slice(1).map((c,ci)=>c?'<td class="'+(ci===0?'l1':'')+'">'+c+'</td>':'<td class="zero">·</td>').join('')+'</tr>';});el.innerHTML=h+'</table>';}
function animCount(el){const to=+el.dataset.count,pre=el.dataset.prefix||'',suf=el.dataset.suffix||'';let s=null;function step(ts){if(!s)s=ts;const p=Math.min((ts-s)/1400,1);const e=1-Math.pow(1-p,3);el.textContent=pre+Math.round(to*e).toLocaleString('en-US')+suf;if(p<1)requestAnimationFrame(step);}requestAnimationFrame(step);}
function go(i){
  if(i<0)i=0;if(i>=scenes.length)i=scenes.length-1;cur=i;
  scenes.forEach(s=>s.classList.remove('active'));bds.forEach(b=>b.classList.remove('active'));dotEls.forEach(d=>d.classList.remove('on'));
  const sc=scenes[i];sc.classList.add('active');if(bds[i])bds[i].classList.add('active');dotEls[i].classList.add('on');
  label.textContent=(i+1)+' / '+scenes.length+' · '+SCENES[i].name;
  const lad=sc.querySelector('#ladder');if(lad)buildLadder(lad);
  const sch=sc.querySelector('#sched');if(sch)buildSched(sch);
  sc.querySelectorAll('[data-count]').forEach(animCount);
  voEl.src=VOS[i]; if(playing){voEl.play().catch(()=>{});} t0=performance.now();
}
function tick(ts){
  const dur=(DURS[cur]+0.5)*1000; const p=Math.min((ts-t0)/dur,1);
  if(playing){bar.style.width=(p*100)+'%'; if(p>=1){ if(cur<scenes.length-1)go(cur+1); else {playing=false;playBtn.textContent='↻';voEl.pause();} }}
  raf=requestAnimationFrame(tick);
}
function setPlay(v){playing=v;playBtn.textContent=v?'❚❚':'▶';
  if(v){ if(cur===scenes.length-1){go(0);} else {voEl.play().catch(()=>{});} musicEl.play().catch(()=>{}); t0=performance.now()-(parseFloat(bar.style.width||0)/100)*((DURS[cur]+0.5)*1000);}
  else {voEl.pause();musicEl.pause();}
}
playBtn.onclick=(e)=>{e.stopPropagation();setPlay(!playing);};
document.getElementById('next').onclick=(e)=>{e.stopPropagation();go(cur+1);};
document.getElementById('prev').onclick=(e)=>{e.stopPropagation();go(cur-1);};
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')go(cur+1);if(e.key==='ArrowLeft')go(cur-1);if(e.key===' '){e.preventDefault();setPlay(!playing);}});
document.getElementById('stage').addEventListener('click',()=>setPlay(!playing));
function start(){ if(started)return;started=true; document.getElementById('gate').style.display='none'; document.getElementById('ctl').style.display='flex';
  musicEl.volume=0.28; musicEl.play().catch(()=>{}); playing=true; go(0); raf=requestAnimationFrame(tick); }
document.getElementById('playbig').onclick=start; document.getElementById('gate').onclick=start;
</script></body></html>`

writeFileSync(OUTFILE, HTML)
const kb = Math.round(Buffer.byteLength(HTML) / 1024)
console.log('[build] wrote', OUTFILE, '(' + kb + ' KB)')
