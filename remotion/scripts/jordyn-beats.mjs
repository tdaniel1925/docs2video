/**
 * JORDYN — THE BEAT SHEET. One script, two cuts, and the pacing fixed.
 *
 * THE PROBLEM THIS SOLVES. v1 held ONE SHOT PER NARRATION LINE. A twelve-word
 * line meant a twelve-second static frame, and the longest single held shot in
 * that film was 10.4 seconds. Twenty-four shots across 130 seconds averages 5.4
 * seconds each, which is a slideshow, not a commercial.
 *
 * Real commercials cut every 1.2-2.5 seconds through their fast sections and
 * hold only where a beat has to land. So a shot here is NOT tied to a line of
 * narration: a single sentence can carry four cuts under it, and the pace is a
 * property of the ACT rather than of the voice.
 *
 * WHAT DRIVES THE PACE. Every act declares a `pace` in seconds per cut, and
 * this file expands the shot list to fill each act at that rate. The fast acts
 * (the problem's job list, the capability montage, the urgency) run 1.0-1.6s.
 * The key frames — the turn, the payback number, the stakes, the trust beat —
 * hold 3-4s because they are the four moments the film is actually for.
 *
 * TWO CUTS FROM ONE SET OF ASSETS. The 45-second version is not a separate
 * production; it selects the beats marked `short` and re-snaps them. Every clip,
 * screenshot and voice line is shared, so the second cut costs nothing.
 */

/* ── the music ─────────────────────────────────────────────────────────────
 *
 * v1's track was 80 BPM and calm, which suited a film about stillness and
 * suits nothing about this one. 122 BPM gives a half-bar of 0.98s — so a cut
 * every half bar IS the fast pace, and cuts can land on every beat in the
 * quickest passages without the edit fighting the music.
 */
export const MUSIC = {
  bpm: 122,
  prompt: 'Confident modern corporate underscore at 122 BPM. Driving but warm — a clear four-on-the-floor pulse, bright plucked synth and muted guitar over a steady kick, optimistic and forward-moving, the feeling of a business accelerating. Builds through the middle, drops to almost nothing for two bars near the end, then returns full for the final statement. Professional, premium, never frantic. No vocals.',
  ms: 135000,
}

/**
 * VOICE. v1 used stability 0.7 for a considered read. This script is direct
 * and sells, so it wants energy: lower stability gives a more dynamic delivery
 * with real variation line to line.
 */
export const VOICE = { voice: 'Rachel', stability: 0.42, model: 'fal-ai/elevenlabs/tts/eleven-v3' }

/**
 * THE ACTS. `pace` is seconds per cut inside that act — the whole point of
 * this file. `short` marks what survives into the 45-second version.
 */
export const ACTS = [
  {
    id: 'logo', pace: 2.4, short: true,
    vo: null,
    shots: [
      { kind: 'logo', see: 'The mark draws on over cream, the sparkle lands', hold: 2.4, short: true },
    ],
  },

  {
    id: 'problem', pace: 1.3, short: true,
    lines: [
      {
        vo: 'Every small business runs on one person. You.',
        line: 'One person', accent: 'One',
        shots: [
          { kind: 'stock', q: 'small business owner opening shop morning', see: 'Owner unlocking, lights coming on', short: true },
          { kind: 'stock', q: 'business owner alone store counter', see: 'Alone behind the counter', short: true },
        ],
      },
      {
        /* THE JOB LIST IS THE FASTEST PASSAGE IN THE FILM. Four roles, four
           cuts, roughly a second each — the edit should feel like the
           overload the line is describing. */
        vo: 'You are the salesperson, the scheduler, the bookkeeper and the receptionist.',
        line: 'All four jobs', accent: 'four',
        pace: 0.95,
        shots: [
          { kind: 'stock', q: 'salesperson helping customer shop', see: 'Serving a customer' },
          { kind: 'stock', q: 'business owner scheduling calendar laptop', see: 'Booking into a calendar' },
          { kind: 'stock', q: 'accountant paperwork receipts desk', see: 'Paperwork and receipts' },
          { kind: 'stock', q: 'receptionist answering phone office', see: 'Answering the phone' },
        ],
      },
      {
        vo: 'Sixty emails a day, and four of them matter.',
        line: 'Sixty. Four matter.', accent: 'Four',
        pace: 1.1,
        shots: [
          { kind: 'stock', q: 'person scrolling email inbox laptop', see: 'Scrolling a full inbox', short: true },
          { kind: 'built', build: 'inbox-count', see: 'A counter running 60; four marking clay', short: true },
        ],
      },
      {
        vo: 'The phone rings while you are with a customer.',
        line: 'It never stops', accent: 'never',
        pace: 1.2,
        shots: [
          { kind: 'stock', q: 'business owner talking customer interrupted', see: 'Mid-conversation with a customer' },
          { kind: 'stock', q: 'phone ringing on desk office', see: 'The phone lighting up, ignored' },
        ],
      },
      {
        vo: 'The invoice you meant to send Tuesday is still there on Friday.',
        line: 'Tuesday. Still there Friday.', accent: 'Still there',
        pace: 1.4,
        shots: [
          { kind: 'built', build: 'invoice-days', see: 'An unsent invoice, the days ticking past it' },
          { kind: 'stock', q: 'tired business owner late night desk', see: 'Late at the desk, shop dark behind' },
        ],
      },
      {
        vo: 'You have thought about hiring. A salary, weeks of training, no guarantee they stay.',
        line: 'Hiring is its own risk', accent: 'risk',
        pace: 1.5,
        shots: [
          { kind: 'stock', q: 'job interview two people desk office', see: 'An interview across a desk' },
          { kind: 'stock', q: 'empty office desk chair', see: 'The desk, empty again' },
        ],
      },
      {
        vo: 'So you keep doing it yourself. And things keep slipping.',
        line: 'So it stays on you', accent: 'on you',
        pace: 1.8, short: true,
        shots: [
          { kind: 'stock', q: 'overwhelmed business owner laptop late', see: 'Still working, late', short: true },
        ],
      },
    ],
  },

  {
    id: 'what-she-is', pace: 2.0, short: true,
    lines: [
      {
        /* KEY FRAME 1 — the turn. Holds, because the whole film pivots here
           and a cut would throw the moment away. */
        vo: 'Jordyn is an AI employee for your business.',
        line: 'An AI employee', accent: 'AI employee',
        shots: [
          { kind: 'anim', prompt: 'Warm morning light flooding into a calm cream room through a tall arched window, a clay-coloured desk neat and ready, a small sage plant, everything in order and waiting. Optimistic, warm, uncluttered.',
            motion: 'Slow confident push-in as warm light strengthens across the room. Dust drifts. Nothing else moves. No people, no text.',
            see: 'THE TURN — warm light filling the room, the desk ready', hold: 3.6, key: true, short: true },
        ],
      },
      {
        vo: 'Not a chatbot. Not another app to check.',
        line: 'Not a chatbot', accent: 'Not',
        pace: 1.2,
        shots: [
          { kind: 'built', build: 'not-chatbot', see: 'A chat window shrinking away to nothing' },
        ],
      },
      {
        vo: 'She connects to the email and phone you already use, learns how your business works, and does the work while you sleep.',
        line: 'Your email. Your number.', accent: 'Your',
        pace: 1.5, short: true,
        shots: [
          { kind: 'built', build: 'connect', see: 'Gmail, Outlook, Fastmail, a phone number — connecting in', short: true },
          { kind: 'product', file: 'hero-screenshot.webp', see: 'The product, working' },
        ],
      },
    ],
  },

  {
    /* THE CAPABILITY MONTAGE. Four claims, and the temptation is a slow
       reveal of each. That is exactly what made v1 drag. Each capability gets
       a product screen AND a supporting cut, roughly 1.4s apiece. */
    id: 'what-she-does', pace: 1.4, short: true,
    lines: [
      {
        vo: 'She works the whole inbox overnight, so the four that matter are on top before your coffee.',
        line: 'Sorted before your coffee', accent: 'before your coffee',
        shots: [
          { kind: 'product', file: 'hero-screenshot.webp', see: 'The real inbox, swept and sorted', short: true },
          { kind: 'stock', q: 'morning coffee laptop desk sunrise', see: 'Coffee, morning light' },
        ],
      },
      {
        vo: 'She answers your phone in your name, and callers book appointments while they are still on the line.',
        line: 'She picks up', accent: 'picks up',
        shots: [
          { kind: 'product', file: 'shot-call.webp', see: 'The call screen — a booking happening mid-call', short: true },
          { kind: 'stock', q: 'person on phone call booking appointment', see: 'A caller, mid-conversation' },
        ],
      },
      {
        vo: 'She writes and she chases. Quotes, follow-ups, invoices, chased until they are paid.',
        line: 'Chased until paid', accent: 'until paid',
        shots: [
          { kind: 'product', file: 'shot-letter.webp', see: 'A drafted follow-up' },
          { kind: 'built', build: 'invoice-paid', see: 'An invoice flipping to PAID', short: true },
        ],
      },
      {
        vo: 'And she remembers everything. Every client, every promise, every deadline.',
        line: 'Nothing forgotten', accent: 'Nothing',
        shots: [
          { kind: 'product', file: 'shot-realestate.webp', see: 'A client workspace, next steps listed' },
        ],
      },
    ],
  },

  {
    /* THE ECONOMICS. Built entirely in Remotion — a generated image cannot be
       trusted with a figure, and these numbers are the argument. Pace is
       moderate because a number needs a moment to read, but never static:
       each figure animates as it lands. */
    id: 'economics', pace: 1.9, short: true,
    lines: [
      {
        vo: 'So look at what you have now. Eight hours a week on email and follow-up.',
        line: 'Eight hours a week', accent: 'Eight hours',
        shots: [
          { kind: 'built', build: 'hours-week', see: 'Eight hour-blocks stacking up' },
        ],
      },
      {
        vo: 'Ten working weeks a year, gone. Twenty-six hundred dollars a month of your own time.',
        line: 'Ten weeks a year', accent: 'Ten weeks',
        pace: 2.1, short: true,
        shots: [
          { kind: 'built', build: 'year-grid', see: '52 squares; ten fill clay and lift away', short: true },
          { kind: 'built', build: 'monthly-cost', see: '$2,600 counting up' },
        ],
      },
      {
        vo: 'Hiring it out? Fifty thousand and up, plus payroll and training.',
        line: 'Or hire at $50k+', accent: '$50k+',
        shots: [
          { kind: 'built', build: 'hire-stack', see: 'The cost of a hire stacking taller' },
        ],
      },
      {
        /* KEY FRAME 2 — the payback. The single most important frame in the
           film. Held, and typed rather than drawn. */
        vo: 'Jordyn is four ninety-nine a month, and pays for herself in five working days.',
        line: 'Pays for itself in 5 days', accent: '5 days',
        shots: [
          { kind: 'built', build: 'payback', see: 'THE MONEY SHOT — $499 beside that column; five days tick off', hold: 3.8, key: true, short: true },
        ],
      },
      {
        vo: 'Every month after that, she gives back five times what she costs.',
        line: '5× back, every month', accent: '5×',
        pace: 2.2, short: true,
        shots: [
          { kind: 'built', build: 'multiple', see: '5× landing, the return filling out', short: true },
        ],
      },
      {
        vo: 'She does not call in sick. She does not quit. She never has a bad week.',
        line: 'Never off. Never gone.', accent: 'Never',
        pace: 1.1,
        shots: [
          { kind: 'stock', q: 'modern office working late evening', see: 'Work continuing into the evening' },
          { kind: 'stock', q: 'night city office windows lit', see: 'Lit windows at night' },
        ],
      },
    ],
  },

  {
    /* WHY NOW — the fastest act in the film. It is about acceleration, so the
       cutting itself has to accelerate. Sub-second cuts under the momentum
       line, which is the one place this film should feel almost frantic. */
    id: 'why-now', pace: 1.1, short: true,
    lines: [
      {
        vo: 'And here is what actually matters. Business is getting faster.',
        line: 'Business is getting faster', accent: 'faster',
        pace: 1.3, short: true,
        shots: [
          { kind: 'stock', q: 'busy modern office people working fast', see: 'A workplace at real pace', short: true },
          { kind: 'stock', q: 'time lapse city business district', see: 'The city, moving' },
        ],
      },
      {
        vo: 'Not next year. Right now, every month, because of AI.',
        line: 'Right now', accent: 'now',
        pace: 0.85,
        shots: [
          { kind: 'stock', q: 'fast typing hands keyboard close up', see: 'Hands, fast' },
          { kind: 'stock', q: 'data screens technology motion', see: 'Screens moving' },
          { kind: 'stock', q: 'people walking fast office corridor', see: 'Movement through a corridor' },
        ],
      },
      {
        vo: 'Your competitors answer in minutes, not days. The customer who waits goes to whoever answered first.',
        line: 'Whoever answers first', accent: 'first',
        pace: 1.4, short: true,
        shots: [
          { kind: 'built', build: 'race-clocks', see: 'Two response clocks — one answers at once, one keeps ticking', short: true },
          { kind: 'stock', q: 'customer waiting phone frustrated', see: 'A customer, still waiting' },
        ],
      },
      {
        /* KEY FRAME 3 — the stakes. */
        vo: 'Every business will have digital staff. The question is whether yours does while it is still an advantage.',
        line: 'While it is still an advantage', accent: 'still an advantage',
        shots: [
          { kind: 'anim', prompt: 'Two clean paths diverging across a wide calm cream ground, one rising confidently upward in deep clay terracotta, the other flattening out in pale sage. Editorial, graphic, generous negative space, no text.',
            motion: 'The frame drifts slowly upward following the rising path as the two separate further. Calm, inevitable. No people, no text.',
            see: 'THE STAKES — two paths diverging, one pulling away', hold: 3.4, key: true, short: true },
        ],
      },
      {
        vo: 'This is where the work is going. Jordyn is how a business gets there now.',
        line: 'This is where work is going', accent: 'where work is going',
        pace: 2.0, short: true,
        shots: [
          { kind: 'product', file: 'hero-screenshot.webp', see: 'The product, confident and full-frame', short: true },
        ],
      },
    ],
  },

  {
    id: 'close', pace: 2.0, short: true,
    lines: [
      {
        /* KEY FRAME 4 — the trust beat. The music drops to almost nothing
           here, so this is the quietest moment in a loud film. That contrast
           is what makes it land. */
        vo: 'And every email she writes is a draft until you press send. Every single one.',
        line: 'Nothing sends without you', accent: 'without you',
        shots: [
          { kind: 'anim', prompt: 'A single deep clay terracotta envelope resting alone and perfectly centred on a wide cream surface, one clean soft shadow beneath it, enormous calm negative space all around. FULL BLEED, no border, no frame, no mat.',
            motion: 'A very slow drift decelerating to a complete deliberate rest. The light settles. Nothing else moves. No people, no text.',
            see: 'THE TRUST BEAT — the draft waiting, motion settling to stillness', hold: 3.6, key: true, short: true },
        ],
      },
      {
        vo: 'She does the work. You keep the last word.',
        line: 'You keep the last word', accent: 'last word',
        pace: 2.2, short: true,
        shots: [
          { kind: 'product', file: 'shot-letter.webp', see: 'A draft, waiting on Send', short: true },
        ],
      },
      {
        vo: 'Type your industry. Her brain builds in thirty seconds. Connect your email, and she learns your business.',
        line: 'Type your industry', accent: 'your industry',
        pace: 1.5, short: true,
        shots: [
          { kind: 'product', file: 'brain-swap.webp', see: 'The brain-build screen, stages ticking past', short: true },
          { kind: 'built', build: 'steps', see: 'Three steps, checking off' },
        ],
      },
      {
        /* THE ASK. Logo, price, trial, address — held long enough to read and
           write down, which is the one place in this film where holding is
           the correct decision. */
        vo: 'Four ninety-nine a month. Fourteen days free. Jordyn dot app.',
        line: 'jordyn.app', accent: 'jordyn.app',
        shots: [
          { kind: 'cta', see: 'LOGO + CTA — the mark, $499/mo, 14 days free, jordyn.app', hold: 4.2, key: true, short: true },
        ],
      },
    ],
  },
]

/** Roughly how long a line takes to say. 2.6 words/sec is a considered
 *  commercial read; measured against v1's real ElevenLabs output. */
const sayTime = (vo) => (vo ? vo.trim().split(/\s+/).length / 2.6 + 0.45 : 0)

/**
 * FIT THE SHOTS TO THE WORDS — without giving up the pace.
 *
 * The pace numbers above say how fast to cut. They do NOT know how long each
 * line takes to speak, and a first pass had 27 lines whose shot group ran
 * shorter than its own narration: the voice would still be talking when the
 * film had moved on.
 *
 * The fix is NOT to hold the shots longer, which is exactly the v1 mistake.
 * It is to add MORE CUTS to cover the extra time, reusing the line's own
 * shots in rotation. A line that needs 5.2s at a 1.3s pace gets four cuts,
 * not one shot held for five seconds.
 *
 * Key frames are exempt: they hold by design, and a held beat is the whole
 * reason they exist.
 */
function fitToVoice(shots, need, pace) {
  if (!shots.length) return shots
  if (shots.some((s) => s.key)) {
    /* a key frame absorbs its line's time by holding — that is its job */
    const span = shots.reduce((t, s) => t + s.hold, 0)
    if (span >= need) return shots
    const grow = (need - span) / shots.length
    return shots.map((s) => ({ ...s, hold: s.hold + grow }))
  }
  const out = []
  let t = 0
  for (let i = 0; t < need - 0.2; i++) {
    const src = shots[i % shots.length]
    /* the last cut takes whatever remains, so the group lands exactly on the
       line rather than drifting past it */
    const left = need - t
    const hold = left < pace * 1.5 ? left : pace
    out.push({ ...src, hold, repeat: i >= shots.length })
    t += hold
  }
  return out
}

/** Flatten the acts into a plain shot list, carrying each act's pace down. */
export function shotList({ short = false } = {}) {
  const out = []
  for (const act of ACTS) {
    if (short && !act.short) continue
    const lines = act.lines ?? [{ vo: act.vo, line: null, accent: null, shots: act.shots }]
    for (const ln of lines) {
      if (short && !ln.short && !(ln.shots ?? []).some((s) => s.short)) continue
      const pace = ln.pace ?? act.pace
      const base = (ln.shots ?? []).filter((s) => !short || s.short || s.key)
      if (!base.length) continue
      const shots = fitToVoice(base, sayTime(ln.vo), pace)
      shots.forEach((s, i) => {
        out.push({
          ...s,
          act: act.id,
          /* the narration rides the FIRST shot of its line; the rest cut
             underneath it, which is the whole point of this file */
          vo: i === 0 ? ln.vo : null,
          line: i === 0 ? ln.line : null,
          accent: i === 0 ? ln.accent : null,
          hold: s.hold ?? pace,
        })
      })
    }
  }
  return out
}

if (process.argv[1]?.endsWith('jordyn-beats.mjs')) {
  for (const short of [false, true]) {
    const l = shotList({ short })
    const secs = l.reduce((a, s) => a + s.hold, 0)
    const kinds = l.reduce((m, s) => ({ ...m, [s.kind]: (m[s.kind] ?? 0) + 1 }), {})
    console.log(`\n${short ? 'SHORT' : 'LONG'} cut: ${l.length} shots, ${secs.toFixed(0)}s, avg ${(secs / l.length).toFixed(2)}s/cut`)
    console.log('  ', Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join('  '))
    console.log('   fastest', Math.min(...l.map((s) => s.hold)).toFixed(2) + 's', '| held', l.filter((s) => s.key).length, 'key frames')
  }
}

/**
 * THE 45-SECOND CUT — its own script, not a subset of the long one.
 *
 * Selecting shots from the long film got it to 119 seconds and no further,
 * because the same sentences take the same time to say however few pictures
 * sit under them. A short cut needs SHORTER WORDS, so this is written to
 * length: the same argument — problem, what she is, the money, why now, ask —
 * compressed to its load-bearing sentences.
 *
 * It reuses the long film's stock footage, product screens and animated
 * clips, so the only new cost is the narration, which is pennies.
 */
export const SHORT_ACTS = [
  {
    id: 'logo', pace: 1.8,
    shots: [{ kind: 'logo', see: 'The mark, the sparkle', hold: 1.8 }],
  },
  {
    id: 'problem', pace: 0.95,
    lines: [
      {
        vo: 'You are the salesperson, the scheduler, the bookkeeper and the receptionist.',
        line: 'All four jobs', accent: 'four',
        shots: [
          { kind: 'stock', q: 'salesperson helping customer shop', see: 'Serving a customer' },
          { kind: 'stock', q: 'business owner scheduling calendar laptop', see: 'Into the calendar' },
          { kind: 'stock', q: 'accountant paperwork receipts desk', see: 'Paperwork' },
          { kind: 'stock', q: 'receptionist answering phone office', see: 'The phone' },
        ],
      },
      {
        vo: 'Sixty emails a day. The phone never stops. And it is all on you.',
        line: 'All on you', accent: 'on you',
        pace: 1.1,
        shots: [
          { kind: 'stock', q: 'person scrolling email inbox laptop', see: 'A full inbox' },
          { kind: 'stock', q: 'phone ringing on desk office', see: 'The phone, ringing' },
          { kind: 'stock', q: 'overwhelmed business owner laptop late', see: 'Still at it, late' },
        ],
      },
    ],
  },
  {
    id: 'what-she-is', pace: 1.6,
    lines: [
      {
        vo: 'Jordyn is an AI employee for your business.',
        line: 'An AI employee', accent: 'AI employee',
        shots: [{ kind: 'anim', reuse: 'turn', see: 'THE TURN — warm light, the desk ready', hold: 3.0, key: true }],
      },
      {
        vo: 'She works your inbox, answers your phone, and chases every invoice until it is paid.',
        line: 'Inbox. Phone. Invoices.', accent: 'Invoices',
        pace: 1.3,
        shots: [
          { kind: 'product', file: 'hero-screenshot.webp', see: 'The inbox, sorted' },
          { kind: 'product', file: 'shot-call.webp', see: 'A booking, mid-call' },
          { kind: 'built', build: 'invoice-paid', see: 'An invoice flipping to PAID' },
        ],
      },
    ],
  },
  {
    id: 'economics', pace: 1.9,
    lines: [
      {
        vo: 'She costs four ninety-nine a month, and pays for herself in five working days.',
        line: 'Pays for itself in 5 days', accent: '5 days',
        shots: [{ kind: 'built', build: 'payback', see: 'THE MONEY SHOT — five days ticking off', hold: 3.4, key: true }],
      },
    ],
  },
  {
    id: 'why-now', pace: 1.0,
    lines: [
      {
        vo: 'Business is getting faster. Your competitors answer in minutes, and the customer who waits goes elsewhere.',
        line: 'Whoever answers first', accent: 'first',
        shots: [
          { kind: 'stock', q: 'busy modern office people working fast', see: 'A workplace at pace' },
          { kind: 'stock', q: 'fast typing hands keyboard close up', see: 'Hands, fast' },
          { kind: 'built', build: 'race-clocks', see: 'Two clocks — one answers, one ticks' },
          { kind: 'stock', q: 'customer waiting phone frustrated', see: 'Still waiting' },
        ],
      },
      {
        vo: 'Get there while it is still an advantage.',
        line: 'While it is still an advantage', accent: 'advantage',
        shots: [{ kind: 'anim', reuse: 'stakes', see: 'THE STAKES — two paths diverging', hold: 2.8, key: true }],
      },
    ],
  },
  {
    id: 'close', pace: 1.8,
    lines: [
      {
        vo: 'And nothing sends without you. Ever.',
        line: 'Nothing sends without you', accent: 'without you',
        shots: [{ kind: 'anim', reuse: 'trust', see: 'THE TRUST BEAT — the draft, waiting', hold: 2.8, key: true }],
      },
      {
        vo: 'Four ninety-nine a month. Fourteen days free. Jordyn dot app.',
        line: 'jordyn.app', accent: 'jordyn.app',
        shots: [{ kind: 'cta', see: 'LOGO + CTA', hold: 3.6, key: true }],
      },
    ],
  },
]

/** The short cut's shot list — same expansion, its own script. */
export function shortList() {
  const out = []
  for (const act of SHORT_ACTS) {
    const lines = act.lines ?? [{ vo: null, line: null, accent: null, shots: act.shots }]
    for (const ln of lines) {
      const pace = ln.pace ?? act.pace
      const shots = fitToVoice(ln.shots ?? [], sayTime(ln.vo), pace)
      shots.forEach((s, i) => out.push({
        ...s, act: act.id,
        vo: i === 0 ? ln.vo : null,
        line: i === 0 ? ln.line : null,
        accent: i === 0 ? ln.accent : null,
        hold: s.hold,
      }))
    }
  }
  return out
}
