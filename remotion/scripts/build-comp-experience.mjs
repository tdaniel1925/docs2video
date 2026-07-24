// Build the Apex comp-plan INTERACTIVE web experience — full-screen click-through
// sections, manual advance (Next/arrows/dots), NO audio. Go-big interactivity:
// clickable rank ladder, live override chart+table, bonus counter, earnings slider.
// Reuses Gemini backdrops (public/htmlaudio/bd-*.png), base64-embedded. One .html.
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
const HERE = dirname(fileURLToPath(import.meta.url))
const A = join(HERE, '..', 'public', 'htmlaudio')
const OUT = join(HERE, '..', 'out', 'apex-comp-experience.html')
const png = (i) => existsSync(join(A, `bd-${i}.png`)) ? 'data:image/png;base64,' + readFileSync(join(A, `bd-${i}.png`)).toString('base64') : ''
const BD = [0, 1, 2, 3, 4, 5, 6, 7].map(png)

// Exact verified comp data
const RANKS = [
  { n: 'Starter', pv: '0', gv: '0', bonus: '—', depth: 1, leg: 'Everyone begins here', h: 60 },
  { n: 'Bronze', pv: '150', gv: '300', bonus: '$250', depth: 2, leg: '', h: 88 },
  { n: 'Silver', pv: '500', gv: '1,500', bonus: '$1,000', depth: 3, leg: '', h: 116 },
  { n: 'Gold', pv: '1,200', gv: '5,000', bonus: '$3,000', depth: 4, leg: '+ 1 sponsored Bronze', h: 144 },
  { n: 'Platinum', pv: '2,500', gv: '15,000', bonus: '$7,500', depth: 5, leg: '+ 2 sponsored Silvers', h: 172 },
  { n: 'Ruby', pv: '4,000', gv: '30,000', bonus: '$12,000', depth: 6, leg: '+ 2 sponsored Golds', h: 200 },
  { n: 'Diamond', pv: '5,000', gv: '50,000', bonus: '$18,000', depth: 7, leg: '', h: 228 },
  { n: 'Crown', pv: '6,000', gv: '75,000', bonus: '$22,000', depth: 7, leg: '', h: 256 },
  { n: 'Elite', pv: '8,000', gv: '120,000', bonus: '$30,000', depth: 7, leg: '', h: 288 },
]
const SCHED = [
  ['Starter', 30, 0, 0, 0, 0, 0, 0], ['Bronze', 30, 20, 0, 0, 0, 0, 0], ['Silver', 30, 20, 18, 0, 0, 0, 0],
  ['Gold', 30, 20, 18, 15, 0, 0, 0], ['Platinum', 30, 20, 18, 15, 10, 0, 0], ['Ruby', 30, 20, 18, 15, 10, 7, 0],
  ['Diamond', 30, 20, 18, 15, 8, 6, 3], ['Crown', 30, 22, 18, 13, 8, 6, 3], ['Elite', 30, 25, 18, 11, 8, 5, 3],
]

const HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Apex Compensation Plan — Explore</title><style>
:root{--navy:#1e3a70;--navy-d:#132649;--red:#c0272d;--cream:#f4efe4;--green:#2f7d4f;--blue:#8fbaff;--mute:#8fa0bd;--white:#fff;--font:'Archivo',-apple-system,'Segoe UI',Roboto,system-ui,sans-serif}
*{box-sizing:border-box;margin:0;padding:0}html,body{height:100%}
body{background:#0b1526;font-family:var(--font);color:#fff;overflow:hidden}
#app{position:relative;width:100vw;height:100vh}
.sec{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5vh 6vw;opacity:0;transform:translateY(30px) scale(.99);transition:opacity .6s ease,transform .6s cubic-bezier(.16,1,.3,1);pointer-events:none;z-index:2}
.sec.on{opacity:1;transform:none;pointer-events:auto}
.bd{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity .9s ease;z-index:0}
.bd.on{opacity:.9;animation:drift 18s ease-in-out infinite alternate}
@keyframes drift{from{transform:scale(1.05)}to{transform:scale(1.16) translateY(-2%)}}
.scrim{position:absolute;inset:0;z-index:1;background:radial-gradient(95% 85% at 50% 45%,rgba(11,21,38,.4),rgba(11,21,38,.85));pointer-events:none}
.kick{display:inline-flex;align-items:center;gap:10px;font-weight:800;font-size:clamp(12px,1.3vw,19px);letter-spacing:.24em;text-transform:uppercase;color:#ff9d9d;margin-bottom:16px}
.kick .st{width:15px;height:15px;background:var(--red);clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)}
h1{font-weight:900;font-size:clamp(32px,5.4vw,80px);line-height:1.02;letter-spacing:-.02em;text-align:center;text-shadow:0 4px 30px rgba(0,0,0,.6)}
h1 .hi{color:#ff8a8a}
.lead{font-weight:700;font-size:clamp(17px,2.3vw,36px);color:var(--cream);max-width:1050px;line-height:1.35;margin-top:12px;text-align:center;text-shadow:0 2px 20px rgba(0,0,0,.6)}
.lead .hi{color:#ffb3b3}.foot{font-weight:600;font-size:clamp(13px,1.5vw,22px);color:#b9c6de;margin-top:24px;text-align:center}
.big{font-weight:900;font-size:clamp(56px,13vw,200px);line-height:.9;letter-spacing:-.03em;text-shadow:0 6px 40px rgba(0,0,0,.6)}
.blue{color:var(--blue)}.green{color:#5fd39a}.red{color:#ff7b80}
.brandcard{background:#fff;color:var(--navy);border-radius:14px;padding:20px 42px;font-weight:900;font-size:clamp(26px,3.6vw,56px);letter-spacing:-.01em;box-shadow:0 24px 60px rgba(0,0,0,.5);margin-bottom:22px}
.brandcard .g{color:var(--red)}.url{font-weight:900;font-size:clamp(19px,2.2vw,38px);margin-top:20px}
.badge{background:var(--red);border-radius:8px;padding:8px 20px;font-weight:800;letter-spacing:.2em;font-size:clamp(12px,1.3vw,20px);margin-bottom:20px}
.twocol{display:flex;gap:clamp(14px,2.5vw,36px);align-items:stretch;flex-wrap:wrap;justify-content:center}
.card{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:clamp(18px,2.6vw,36px);min-width:250px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,.4);backdrop-filter:blur(4px)}
.card .t{font-weight:900;font-size:clamp(28px,3.6vw,58px)}.card .s{font-weight:700;font-size:clamp(13px,1.5vw,24px);color:var(--mute);margin-top:8px}
.plus{display:flex;align-items:center;font-weight:900;font-size:clamp(28px,3.6vw,54px);color:var(--mute)}
/* clickable ladder */
.ladwrap{display:flex;gap:40px;align-items:center;flex-wrap:wrap;justify-content:center;width:100%}
.ladder{display:flex;align-items:flex-end;gap:clamp(5px,.9vw,14px);height:min(46vh,340px)}
.rung{display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;transition:transform .2s}
.rung:hover{transform:translateY(-6px)}
.rung .bar{width:clamp(40px,4vw,84px);border-radius:8px 8px 0 0;background:linear-gradient(180deg,#2f5aa8,var(--navy));box-shadow:0 0 18px rgba(30,58,112,.5);transition:all .25s}
.rung.sel .bar{background:linear-gradient(180deg,#e0454b,var(--red));box-shadow:0 0 30px rgba(192,39,45,.7)}
.rung .lbl{font-weight:700;font-size:clamp(10px,1vw,18px);color:#cdd8ec}.rung.sel .lbl{color:#ff8a8a}
.rankpanel{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:30px 40px;min-width:330px;box-shadow:0 20px 50px rgba(0,0,0,.4);backdrop-filter:blur(6px)}
.rankpanel .rn{font-weight:900;font-size:clamp(34px,4vw,58px);color:var(--white);letter-spacing:-.02em}
.rp-row{display:flex;justify-content:space-between;gap:30px;margin-top:16px;font-weight:700;font-size:clamp(16px,1.7vw,26px)}
.rp-row .k{color:var(--mute)}.rp-row .v{color:var(--cream)}
.rp-bonus{margin-top:18px;font-weight:900;font-size:clamp(30px,3.4vw,50px);color:#5fd39a}
.rp-leg{margin-top:10px;color:var(--blue);font-weight:700;font-size:clamp(14px,1.5vw,22px)}
.hintsm{font-size:13px;color:var(--mute);margin-top:22px}
/* schedule table */
table{border-collapse:separate;border-spacing:5px;font-size:clamp(11px,1.25vw,21px)}
th{color:var(--red);font-weight:800;padding:4px 8px}th.rank,td.rank{text-align:left;color:var(--cream);font-weight:800}
td{text-align:center;font-weight:700;padding:6px 10px;border-radius:7px;background:rgba(255,255,255,.06);color:#e8eefc;min-width:50px}
td.zero{color:#4b5a76;background:transparent;font-weight:400}td.l1{color:var(--blue);background:rgba(30,58,112,.4)}
tr.top td:not(.zero){background:rgba(192,39,45,.22)}tr.top td.rank{color:#ff8a8a}
/* earnings calculator */
.calc{display:flex;gap:50px;align-items:center;flex-wrap:wrap;justify-content:center;width:100%;max-width:1500px}
.calc .controls{flex:1;min-width:360px}
.ctlrow{margin-bottom:26px}
.ctlrow label{display:flex;justify-content:space-between;font-weight:800;font-size:clamp(16px,1.8vw,26px);margin-bottom:10px}
.ctlrow label .val{color:var(--red)}
input[type=range]{width:100%;height:8px;border-radius:5px;background:rgba(255,255,255,.15);appearance:none;outline:none}
input[type=range]::-webkit-slider-thumb{appearance:none;width:26px;height:26px;border-radius:50%;background:var(--red);cursor:pointer;box-shadow:0 4px 12px rgba(192,39,45,.5)}
select{width:100%;padding:12px 16px;border-radius:10px;background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.2);font:inherit;font-weight:700;font-size:20px}
.result{flex:1;min-width:360px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);border-radius:20px;padding:34px 40px;box-shadow:0 20px 50px rgba(0,0,0,.4);backdrop-filter:blur(6px)}
.result .rtot{font-weight:900;font-size:clamp(46px,7vw,96px);color:#5fd39a;line-height:.95;letter-spacing:-.03em}
.result .rsub{color:var(--mute);font-weight:700;font-size:clamp(15px,1.7vw,24px);margin-bottom:20px}
.rbar{margin-bottom:16px}
.rbar .rb-top{display:flex;justify-content:space-between;font-weight:700;font-size:clamp(15px,1.6vw,22px);margin-bottom:6px}
.rbar .rb-track{height:16px;background:rgba(255,255,255,.09);border-radius:8px;overflow:hidden}
.rbar .rb-fill{height:100%;border-radius:8px;transition:width .35s cubic-bezier(.16,1,.3,1)}
.rnote{font-size:13px;color:var(--mute);margin-top:14px;font-style:italic}
/* nav */
#bar{position:fixed;left:0;top:0;height:4px;background:var(--red);width:0;z-index:40;transition:width .35s ease}
#nav{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:10px;z-index:50;background:rgba(11,21,38,.82);border:1px solid rgba(255,255,255,.16);border-radius:999px;padding:8px 12px;backdrop-filter:blur(8px)}
#nav button{background:rgba(255,255,255,.1);border:none;color:#fff;font:inherit;font-weight:800;font-size:16px;height:42px;border-radius:21px;cursor:pointer;transition:background .2s;display:flex;align-items:center;justify-content:center;padding:0 18px;gap:8px}
#nav button.icon{width:42px;padding:0}#nav button:hover{background:var(--red)}
#dots{display:flex;gap:7px;margin:0 6px}#dots i{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.25);cursor:pointer;transition:all .2s}#dots i.on{background:var(--red);transform:scale(1.25)}
#nav .lab{font-size:13px;color:var(--mute);padding:0 8px;min-width:130px;text-align:center}
.tag{position:fixed;top:16px;right:20px;font-size:12px;color:var(--mute);z-index:40}
.reveal{opacity:0;transform:translateY(24px)}
.on .reveal{animation:rv .6s cubic-bezier(.16,1,.3,1) forwards}
.on .reveal.d1{animation-delay:.1s}.on .reveal.d2{animation-delay:.2s}.on .reveal.d3{animation-delay:.3s}
@keyframes rv{to{opacity:1;transform:none}}
</style></head><body>
<div id="bar"></div><div class="tag">Interactive · click ‹ › or use arrow keys</div>
<div id="app"></div>
<div id="nav"><button class="icon" id="prev">‹</button><span class="lab" id="lab"></span><button id="next">Next ›</button><div id="dots"></div></div>
<script>
const BD=${JSON.stringify(BD)};
const RANKS=${JSON.stringify(RANKS)};
const SCHED=${JSON.stringify(SCHED)};
// section builders return html; some have an init(el) for interactivity
const SECTIONS=[
 {name:'Welcome',bd:0,html:()=>\`<div class="badge reveal">★ APEX · TECHNOLOGY PLAN</div><div class="brandcard reveal d1">APEX <span class="g">AFFINITY GROUP</span></div><h1 class="reveal d2">The Compensation Plan</h1><div class="lead reveal d3">Explore how you get paid — at your own pace. Click <b>Next</b> to begin.</div>\`},
 {name:'What is B.V.',bd:1,html:()=>\`<div class="kick reveal"><span class="st"></span>Key Term</div><h1 class="reveal d1">What Is <span class="hi">B.V.?</span></h1><div class="lead reveal d2">For every product, Apex <span class="hi">designates a Business Volume</span> — the amount your commission is based on.</div><div class="foot reveal d3">Docs2Video 9 → 122 BV · SmartViewz 69 BV · Lite 32 BV</div>\`},
 {name:'Two Ways To Earn',bd:2,html:()=>\`<div class="kick reveal"><span class="st"></span>How You Get Paid</div><h1 class="reveal d1" style="margin-bottom:34px">You Earn <span class="hi">Two Ways.</span></h1><div class="twocol reveal d2"><div class="card"><div class="t blue">You Sell</div><div class="s">commission on the B.V.<br>of what you sell</div></div><div class="plus">+</div><div class="card"><div class="t red">Team Sells</div><div class="s">override income as<br>your team sells too</div></div></div><div class="foot reveal d3">Do both — your income <span style="color:#5fd39a">compounds.</span></div>\`},
 {name:'The 9 Ranks',bd:3,init:'ladder',html:()=>\`<div class="kick reveal"><span class="st"></span>Technology · 9 Ranks · Click Any Rank</div><h1 class="reveal d1" style="margin-bottom:24px">Climb From <span class="hi">Starter → Elite.</span></h1><div class="ladwrap reveal d2"><div class="ladder" id="ladder"></div><div class="rankpanel" id="rankpanel"></div></div><div class="hintsm reveal d3">👆 Click a bar to see that rank's targets and bonus.</div>\`},
 {name:'Override Schedule',bd:4,init:'sched',html:()=>\`<div class="kick reveal"><span class="st"></span>The Override Schedule</div><h1 class="reveal d1" style="margin-bottom:20px">Earn <span class="hi">Deeper</span> As You Climb.</h1><div class="reveal d2" id="sched"></div><div class="foot reveal d3">Level 1 is always 30%. At <span style="color:#5fd39a">Ruby & above</span>, you earn on the entire pool.</div>\`},
 {name:'Rank Bonuses',bd:5,init:'count',html:()=>\`<div class="kick reveal"><span class="st"></span>One-Time Rank Bonuses</div><div class="big blue reveal d1" data-count="93750" data-prefix="$">$0</div><div class="lead reveal d2" style="margin-top:14px">in bonuses along the way — Starter → Elite.</div><div class="foot reveal d3">Paid once per rank · illustrative</div>\`},
 {name:'Earnings Explorer',bd:6,init:'calc',html:()=>\`<div class="kick reveal"><span class="st"></span>Interactive · Move The Sliders</div><h1 class="reveal d1" style="font-size:clamp(28px,4vw,60px);margin-bottom:26px">What Could <span class="hi">You</span> Build?</h1>
   <div class="calc reveal d2">
     <div class="controls">
       <div class="ctlrow"><label>Your rank <span class="val" id="v-rank">Silver</span></label><input type="range" id="s-rank" min="1" max="8" value="2"></div>
       <div class="ctlrow"><label>Direct partners <span class="val" id="v-dir">5</span></label><input type="range" id="s-dir" min="0" max="10" value="5"></div>
       <div class="ctlrow"><label>Each partner's team <span class="val" id="v-team">5</span></label><input type="range" id="s-team" min="0" max="10" value="5"></div>
       <div class="ctlrow"><label>Sales per person / month <span class="val" id="v-sales">3</span></label><input type="range" id="s-sales" min="1" max="10" value="3"></div>
     </div>
     <div class="result">
       <div class="rtot" id="r-total">$0</div>
       <div class="rsub">estimated monthly income · <span id="r-people">30</span> people on your team</div>
       <div class="rbar"><div class="rb-top"><span>Direct commissions</span><span id="r-d">$0</span></div><div class="rb-track"><div class="rb-fill" id="rb-d" style="background:var(--blue)"></div></div></div>
       <div class="rbar"><div class="rb-top"><span>Team overrides</span><span id="r-o">$0</span></div><div class="rb-track"><div class="rb-fill" id="rb-o" style="background:#5fd39a"></div></div></div>
       <div class="rnote">Illustrative model using each product's designated B.V. Real results vary.</div>
     </div>
   </div>\`},
 {name:'Qualify',bd:7,init:'count',html:()=>\`<div class="kick reveal"><span class="st"></span>To Earn Overrides</div><div class="big green reveal d1" data-count="50" data-suffix=" PV">0 PV</div><div class="lead reveal d2" style="margin-top:14px">personal volume each month. Sell a little, <span class="hi">stay qualified.</span></div><div class="foot reveal d3">Miss a month? A 30-day grace period. Your highest rank is permanent.</div>\`},
 {name:'Get Started',bd:0,html:()=>\`<div class="brandcard reveal">APEX <span class="g">AFFINITY GROUP</span></div><h1 class="reveal d1">Sell The Tools. <span class="hi">Build Your Team.</span></h1><div class="url reveal d2">reachtheapex.net</div>\`},
];

const app=document.getElementById('app');
SECTIONS.forEach((s,i)=>{const bd=document.createElement('div');bd.className='bd';if(BD[s.bd])bd.style.backgroundImage='url('+BD[s.bd]+')';bd.dataset.i=i;app.appendChild(bd);});
const scrim=document.createElement('div');scrim.className='scrim';app.appendChild(scrim);
SECTIONS.forEach((s,i)=>{const d=document.createElement('div');d.className='sec';d.dataset.i=i;d.innerHTML=s.html();app.appendChild(d);});
const secs=[...document.querySelectorAll('.sec')],bds=[...document.querySelectorAll('.bd')];
const dots=document.getElementById('dots');SECTIONS.forEach((s,i)=>{const b=document.createElement('i');b.onclick=()=>go(i);dots.appendChild(b);});
const dotEls=[...dots.children],bar=document.getElementById('bar'),lab=document.getElementById('lab');
let cur=-1;

function animCount(el){const to=+el.dataset.count,pre=el.dataset.prefix||'',suf=el.dataset.suffix||'';let s=null;function step(ts){if(!s)s=ts;const p=Math.min((ts-s)/1500,1);const e=1-Math.pow(1-p,3);el.textContent=pre+Math.round(to*e).toLocaleString('en-US')+suf;if(p<1)requestAnimationFrame(step);}requestAnimationFrame(step);}

function initLadder(sec){
  const lad=sec.querySelector('#ladder'),panel=sec.querySelector('#rankpanel');
  lad.innerHTML='';
  RANKS.forEach((r,i)=>{const d=document.createElement('div');d.className='rung';d.dataset.i=i;
    d.innerHTML='<div class="bar" style="height:'+r.h+'px"></div><div class="lbl">'+r.n+'</div>';
    d.onclick=()=>selRank(i);lad.appendChild(d);});
  function selRank(i){[...lad.children].forEach((c,k)=>c.classList.toggle('sel',k===i));
    const r=RANKS[i];
    panel.innerHTML='<div class="rn">'+r.n+'</div>'+
      '<div class="rp-row"><span class="k">Personal (PV)</span><span class="v">'+r.pv+'</span></div>'+
      '<div class="rp-row"><span class="k">Group (GV)</span><span class="v">'+r.gv+'</span></div>'+
      '<div class="rp-row"><span class="k">Earns on</span><span class="v">'+r.depth+' level'+(r.depth>1?'s':'')+' deep</span></div>'+
      (r.bonus!=='—'?'<div class="rp-bonus">'+r.bonus+' rank bonus</div>':'<div class="rp-bonus" style="color:var(--mute)">No requirements</div>')+
      (r.leg?'<div class="rp-leg">'+r.leg+'</div>':'');
  }
  selRank(2); // default Silver
}
function initSched(sec){const el=sec.querySelector('#sched');let h='<table><tr><th class="rank">RANK</th>'+['L1','L2','L3','L4','L5','L6','L7'].map(x=>'<th>'+x+'</th>').join('')+'</tr>';
  SCHED.forEach((row,r)=>{h+='<tr class="'+(r===8?'top':'')+'"><td class="rank">'+row[0]+'</td>'+row.slice(1).map((c,ci)=>c?'<td class="'+(ci===0?'l1':'')+'">'+c+'%</td>':'<td class="zero">·</td>').join('')+'</tr>';});
  el.innerHTML=h+'</table>';}
function initCalc(sec){
  const RANK_NAMES=['Starter','Bronze','Silver','Gold','Platinum','Ruby','Diamond','Crown','Elite'];
  // L1 override % and combined deeper % (of pool) by rank index
  const L1=30, DEEP=[0,20,38,53,63,70,72,72,72]; // rough sum of L2+ by rank
  const BV=69, SELLER=BV*0.60, POOL=BV*0.40; // one 69-BV sub
  const el=id=>sec.querySelector(id);
  function calc(){
    const ri=+el('#s-rank').value, dir=+el('#s-dir').value, team=+el('#s-team').value, sales=+el('#s-sales').value;
    const l2people=dir*team, people=dir+l2people;
    el('#v-rank').textContent=RANK_NAMES[ri]; el('#v-dir').textContent=dir; el('#v-team').textContent=team; el('#v-sales').textContent=sales;
    el('#r-people').textContent=people;
    // your own direct: assume you sell 'sales' subs
    const direct=sales*SELLER;
    // overrides: L1 pool on your dir's sales + deeper on l2 sales, scaled by rank
    const l1sales=dir*sales, l2sales=l2people*sales;
    const ov=l1sales*POOL*(L1/100) + l2sales*POOL*(DEEP[ri]/100);
    const total=direct+ov;
    const money=n=>'$'+Math.round(n).toLocaleString('en-US');
    el('#r-total').textContent=money(total); el('#r-d').textContent=money(direct); el('#r-o').textContent=money(ov);
    const max=Math.max(direct,ov,1);
    el('#rb-d').style.width=(direct/max*100)+'%'; el('#rb-o').style.width=(ov/max*100)+'%';
  }
  ['#s-rank','#s-dir','#s-team','#s-sales'].forEach(id=>el(id).addEventListener('input',calc));
  calc();
}
const INITS={ladder:initLadder,sched:initSched,calc:initCalc};

function go(i){
  if(i<0)i=0;if(i>=secs.length)i=secs.length-1;cur=i;
  secs.forEach(s=>s.classList.remove('on'));bds.forEach(b=>b.classList.remove('on'));dotEls.forEach(d=>d.classList.remove('on'));
  const sec=secs[i];sec.classList.add('on');if(bds[i])bds[i].classList.add('on');dotEls[i].classList.add('on');
  lab.textContent=(i+1)+' / '+secs.length+' · '+SECTIONS[i].name;
  bar.style.width=((i)/(secs.length-1)*100)+'%';
  const conf=SECTIONS[i];
  if(conf.init==='count')sec.querySelectorAll('[data-count]').forEach(animCount);
  else if(INITS[conf.init])INITS[conf.init](sec);
  document.getElementById('next').textContent=(i===secs.length-1?'Restart ↻':'Next ›');
}
document.getElementById('next').onclick=()=>{ if(cur>=secs.length-1)go(0); else go(cur+1); };
document.getElementById('prev').onclick=()=>go(cur-1);
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='PageDown'){e.preventDefault();if(cur>=secs.length-1)go(0);else go(cur+1);}if(e.key==='ArrowLeft'||e.key==='PageUp'){e.preventDefault();go(cur-1);}});
go(0);
</script></body></html>`

writeFileSync(OUT, HTML)
console.log('[build] wrote', OUT, '(' + Math.round(Buffer.byteLength(HTML) / 1024) + ' KB)')
