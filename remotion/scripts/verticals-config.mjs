// Shared config for all 9 Jordyn vertical videos. Each vertical: id, label,
// 10 VO lines (industry-specific use cases), 10 scene prompts, and per-scene
// caption data (consumed by the composition via <id>.json).
// ~75-90s each. Flat-editorial style. Grounded in real Jordyn features +
// real industry workflows.

export const STYLE = "Flat modern editorial vector illustration, soft warm muted style. Palette: warm cream #faf9f5 background, terracotta rust #c4623f, warm tan #d8a07a, sage green #b6c4a2, soft gold #e5d9a8, muted charcoal #4a3f35. Gentle soft shadows, simple rounded organic shapes, subtle film grain, calm premium, generous negative space, high-end SaaS brand illustration, soft ambient light. 16:9. NO text, NO letters, NO logos, NO words."

// 10 scenes per vertical. Scene roles (shared across all verticals):
//  0 hook (the pro, busy)  1 "generic AI knows nothing"  2 "Jordyn knows <industry>"
//  3-6 four industry USE CASES (the creative, specific part)
//  7 "nothing sends without your OK"  8 ROI  9 finale (hero, room for logo)
// Caption fields: kicker?, head, sub?, accent? (rust word), pill? (bool), stat?

export const VERTICALS = {
  insurance: {
    label: 'insurance agents',
    lines: [
      "You didn't get licensed to live in your inbox. But here you are — quotes, apps, and underwriting, all at once.", // 0
      "Generic AI doesn't know a term conversion from a term life. It's a blank box, waiting on you.", // 1
      "Jordyn is different. It arrives already fluent in insurance — carriers, products, underwriting, compliance.", // 2
      "A policy's up for conversion? Jordyn drafts the conversion letter and flags the deadline before it lapses.", // 3
      "Waiting on an APS or a medical exam? Jordyn tracks every outstanding requirement and follows up automatically.", // 4
      "Annual review season? Jordyn preps the agenda, pulls the values, and books the meeting — in your voice.", // 5
      "New lead in your inbox? Jordyn logs the case, records the carrier and product, and moves it down your pipeline.", // 6
      "It drafts every quote follow-up and client letter — and nothing sends without your okay.", // 7
      "That's hours back each week, and renewals that don't slip through the cracks. One placed case covers years of it.", // 8
      "Jordyn. The AI assistant with a brain for insurance.", // 9
    ],
    scenes: [
      `${STYLE} A friendly insurance agent character (terracotta blazer) at a desk, a little overwhelmed, soft floating policy documents, quote forms, and envelopes around them, morning light.`,
      `${STYLE} An insurance agent looking uncertain at a large empty rounded chat panel with a blinking cursor, a subtle question mark, minimal, the AI knows nothing.`,
      `${STYLE} A warm glowing terracotta 'brain' orb radiating gentle rays surrounded by soft flat insurance icons — a shield, a policy document, a small umbrella — assembling, an assistant that knows insurance, no character.`,
      `${STYLE} A flat illustration of a formal letter/document (a conversion letter) with a soft calendar and a gentle deadline flag/clock beside it, warm accents, organized, no readable text.`,
      `${STYLE} A flat checklist of outstanding requirements — a medical/exam icon, a document icon, a signature icon — with soft checkmarks appearing and a follow-up arrow, tidy, no readable text.`,
      `${STYLE} An insurance agent calmly preparing an annual review — a soft folder with a chart/values page, a calendar with a booked meeting, a coffee cup, warm and organized.`,
      `${STYLE} A self-building pipeline of soft rounded case cards flowing left to right into tidy columns (lead, quoted, submitted, issued), sage and gold accents, upward progress, no character, no readable text.`,
      `${STYLE} An insurance agent reviewing a nicely formatted letter the assistant drafted, a small approval checkmark and a pen, pleased, an approval moment.`,
      `${STYLE} A calm 'time and money saved' concept — a soft clock with sparkles and a small rising chart plus a shield/policy-issued badge, warm optimistic, no character, no readable text.`,
      `${STYLE} A confident insurance agent standing calmly holding a tablet, soft sage leaf shapes in a rounded frame behind them, self-assured, generous empty cream space lower-center for a logo, optimistic finale.`,
    ],
    captions: [
      { head: 'Licensed to sell.', sub: 'Not to live in your inbox.' },
      { head: 'Generic AI knows nothing about insurance.', small: true },
      { logoHead: 'knows insurance.', sub: 'Carriers, products, underwriting, compliance.' },
      { kicker: 'Use case', head: 'Conversions, handled.', sub: 'Drafts the letter. Flags the deadline before it lapses.' },
      { kicker: 'Use case', head: 'Requirements, tracked.', sub: 'APS, exams, signatures — followed up automatically.' },
      { kicker: 'Use case', head: 'Annual reviews, prepped.', sub: 'Agenda, values, and the meeting — booked in your voice.' },
      { kicker: 'Use case', head: 'A pipeline that builds itself.', sub: 'Every case logged from your email — carrier, product, status.' },
      { head: 'Drafted in your voice.', sub: 'Nothing sends without your OK.', accent: 'Nothing sends without your OK.' },
      { head: 'Hours back. Renewals that never slip.', sub: 'One placed case covers years of it.', accent: 'One placed case covers years of it.' },
      { finale: true },
    ],
    tagIntro: 'The AI assistant with a brain for insurance.',
  },

  realestate: {
    label: 'real estate agents',
    lines: [
      "You're closing deals from your phone in a parking lot. The paperwork doesn't care that you're busy.", // 0
      "Generic AI doesn't know a contingency from a commission. It's a blank box, waiting on you.", // 1
      "Jordyn is different. It arrives already fluent in real estate — listings, contracts, closings, deadlines.", // 2
      "Offer accepted? Jordyn tracks the inspection and appraisal deadlines so a contingency never lapses.", // 3
      "New listing? Jordyn drafts the listing announcement and the just-listed emails — in your voice.", // 4
      "Under contract? Jordyn sends the buyer recap and nudges the lender before the closing date.", // 5
      "Every lead and showing logged automatically, so your pipeline is always current — without the busywork.", // 6
      "It drafts your follow-ups, letters, and client updates — and nothing sends without your okay.", // 7
      "That's hours back each week, and deals that don't fall out of contract. One closing covers years of it.", // 8
      "Jordyn. The AI assistant with a brain for real estate.", // 9
    ],
    scenes: [
      `${STYLE} A friendly real estate agent character (terracotta blazer) juggling a phone and paperwork, soft floating 'for sale' sign, house shapes and contract documents around them, busy but warm.`,
      `${STYLE} A real estate agent looking uncertain at a large empty rounded chat panel with a blinking cursor, a subtle question mark, minimal.`,
      `${STYLE} A warm glowing terracotta 'brain' orb radiating rays surrounded by soft flat real-estate icons — a little house, a key, a contract, a sold sign — assembling, no character.`,
      `${STYLE} A flat home-inspection / appraisal concept — a house with a magnifying glass and a clipboard, a calendar with a deadline flag/clock, warm accents, no readable text.`,
      `${STYLE} A flat 'just listed' concept — a house with a for-sale sign and soft email/envelope shapes flowing out announcing it, tan and sage accents, no readable text.`,
      `${STYLE} A real estate agent calmly reviewing a closing timeline — a document, a calendar with a closing date, a small handshake and a bank/lender icon, organized.`,
      `${STYLE} A self-building pipeline of soft rounded property/deal cards flowing into columns (lead, showing, offer, under contract, closed), sage and gold accents, no character, no readable text.`,
      `${STYLE} A real estate agent reviewing a nicely formatted client update the assistant drafted, an approval checkmark and pen, pleased.`,
      `${STYLE} A calm 'time and money saved' concept — a clock with sparkles and a rising chart plus a small 'sold' house badge, warm, no character, no readable text.`,
      `${STYLE} A confident real estate agent standing calmly holding a tablet, soft sage leaf shapes in a rounded frame behind, self-assured, generous empty cream space lower-center for a logo, finale.`,
    ],
    captions: [
      { head: 'Closing deals from a parking lot.', small: true, sub: 'The paperwork doesn’t care that you’re busy.' },
      { head: 'Generic AI knows nothing about real estate.', small: true },
      { logoHead: 'knows real estate.', sub: 'Listings, contracts, closings, deadlines.' },
      { kicker: 'Use case', head: 'Contingencies, protected.', sub: 'Inspection & appraisal deadlines — tracked so none lapse.' },
      { kicker: 'Use case', head: 'Just-listed, announced.', sub: 'Listing emails drafted in your voice.' },
      { kicker: 'Use case', head: 'Closings, on track.', sub: 'Buyer recaps sent, the lender nudged before the date.' },
      { kicker: 'Use case', head: 'A pipeline that builds itself.', sub: 'Every lead and showing logged automatically.' },
      { head: 'Drafted in your voice.', sub: 'Nothing sends without your OK.', accent: 'Nothing sends without your OK.' },
      { head: 'Hours back. Deals that don’t fall through.', sub: 'One closing covers years of it.', accent: 'One closing covers years of it.' },
      { finale: true },
    ],
    tagIntro: 'The AI assistant with a brain for real estate.',
  },

  law: {
    label: 'law firms',
    lines: [
      "Billable hours are the job. So why do yours disappear into email and intake?", // 0
      "Generic AI doesn't know a retainer from a rebuttal. It's a blank box, waiting on you.", // 1
      "Jordyn is different. It arrives already fluent in legal work — matters, deadlines, and confidentiality.", // 2
      "New matter? Jordyn drafts the engagement letter and opens the file — before the client's off the phone.", // 3
      "A filing deadline looming? Jordyn watches your calendar and flags it well before it's due.", // 4
      "Retainer unsigned? Jordyn chases the signature and files it the moment it comes back.", // 5
      "Every matter, decision, and pending to-do recorded from your email, automatically.", // 6
      "It drafts your correspondence in your voice — privilege-aware, and nothing sends without your okay.", // 7
      "That's billable time reclaimed, and deadlines you never miss. One retained client covers years of it.", // 8
      "Jordyn. The AI assistant with a brain for law.", // 9
    ],
    scenes: [
      `${STYLE} A friendly attorney character (terracotta blazer) at a desk with soft floating legal documents, a gavel shape, and envelopes, a bit overwhelmed, warm.`,
      `${STYLE} An attorney looking uncertain at a large empty rounded chat panel with a blinking cursor, a subtle question mark, minimal.`,
      `${STYLE} A warm glowing terracotta 'brain' orb radiating rays surrounded by soft flat legal icons — scales of justice, a gavel, a document, a lock for confidentiality — assembling, no character.`,
      `${STYLE} A flat engagement-letter concept — a formal document with a pen and a new file folder opening, warm accents, professional, no readable text.`,
      `${STYLE} A flat filing-deadline concept — a calendar with a clear deadline flag and a soft clock, a court/document icon, a gentle alert, no readable text.`,
      `${STYLE} A flat 'chase the signature' concept — a document with a signature line, a soft reminder arrow looping, a checkmark when signed, no readable text.`,
      `${STYLE} A self-building matter list of soft rounded case cards flowing into tidy columns, a small scales-of-justice motif, sage and gold accents, no character, no readable text.`,
      `${STYLE} An attorney reviewing a nicely formatted letter the assistant drafted, an approval checkmark and a small confidentiality lock, pleased.`,
      `${STYLE} A calm 'billable time reclaimed' concept — a clock with sparkles and a rising chart, a small scales badge, warm, no character, no readable text.`,
      `${STYLE} A confident attorney standing calmly holding a tablet, soft sage leaf shapes in a rounded frame behind, self-assured, generous empty cream space lower-center for a logo, finale.`,
    ],
    captions: [
      { head: 'Billable hours are the job.', sub: 'So why do yours vanish into email?' },
      { head: 'Generic AI knows nothing about legal work.', small: true },
      { logoHead: 'knows law.', sub: 'Matters, deadlines, and confidentiality.' },
      { kicker: 'Use case', head: 'Engagement letters, drafted.', sub: 'The file opened before the client’s off the phone.' },
      { kicker: 'Use case', head: 'Deadlines, never missed.', sub: 'Filing dates flagged well before they’re due.' },
      { kicker: 'Use case', head: 'Retainers, signed.', sub: 'The signature chased — and filed the moment it’s back.' },
      { kicker: 'Use case', head: 'A matter list that builds itself.', sub: 'Every matter and to-do recorded from your email.' },
      { head: 'Privilege-aware. In your voice.', sub: 'Nothing sends without your OK.', accent: 'Nothing sends without your OK.' },
      { head: 'Billable time, reclaimed.', sub: 'One retained client covers years of it.', accent: 'One retained client covers years of it.' },
      { finale: true },
    ],
    tagIntro: 'The AI assistant with a brain for law.',
  },

  hvac: {
    label: 'HVAC companies',
    lines: [
      "You're on a roof, not at a desk. But the quotes, the scheduling, the follow-ups pile up anyway.", // 0
      "Generic AI doesn't know a heat pump from a hard start. It's a blank box, waiting on you.", // 1
      "Jordyn is different. It arrives already fluent in the trade — service, installs, maintenance, and estimates.", // 2
      "Estimate go quiet? Jordyn follows up on the quote so the job doesn't go to the other guy.", // 3
      "Maintenance season? Jordyn books the tune-ups and reminds every customer whose service is due.", // 4
      "Service call comes in? Jordyn logs it, schedules it, and confirms the appointment the day before.", // 5
      "Every job, customer, and pending estimate recorded from your email and texts, automatically.", // 6
      "It drafts your quotes and customer messages — and nothing sends without your okay.", // 7
      "That's more jobs booked and fewer estimates that die on the vine. One install covers years of it.", // 8
      "Jordyn. The AI assistant with a brain for HVAC.", // 9
    ],
    scenes: [
      `${STYLE} A friendly HVAC technician character (in work attire with a warm palette) near an AC unit, soft floating invoice, schedule, and wrench shapes, busy, warm.`,
      `${STYLE} An HVAC technician looking uncertain at a large empty rounded chat panel with a blinking cursor, a subtle question mark, minimal.`,
      `${STYLE} A warm glowing terracotta 'brain' orb radiating rays surrounded by soft flat HVAC icons — a wrench, an AC unit, a thermostat, a tool — assembling, no character.`,
      `${STYLE} A flat 'follow up on the estimate' concept — a quote/invoice document with a soft reminder arrow and a phone/message icon, warm accents, no readable text.`,
      `${STYLE} A flat maintenance-season concept — a calendar full of booked tune-up appointments, a thermostat and a checkmark, tidy, no readable text.`,
      `${STYLE} A flat service-scheduling concept — a service ticket, a calendar slot, and a confirmation checkmark with a small clock, no readable text.`,
      `${STYLE} A self-building job pipeline of soft rounded job cards flowing into columns (lead, quoted, scheduled, done), a small wrench motif, sage and gold accents, no character, no readable text.`,
      `${STYLE} An HVAC technician reviewing a nicely formatted quote the assistant drafted on a tablet, an approval checkmark, pleased.`,
      `${STYLE} A calm 'more jobs booked' concept — a clock with sparkles and a rising chart, a small AC-unit badge, warm, no character, no readable text.`,
      `${STYLE} A confident HVAC business owner standing calmly holding a tablet, soft sage leaf shapes in a rounded frame behind, self-assured, generous empty cream space lower-center for a logo, finale.`,
    ],
    captions: [
      { head: 'You’re on a roof, not at a desk.', small: true, sub: 'The paperwork piles up anyway.' },
      { head: 'Generic AI knows nothing about the trade.', small: true },
      { logoHead: 'knows HVAC.', sub: 'Service, installs, maintenance, estimates.' },
      { kicker: 'Use case', head: 'Estimates, followed up.', sub: 'So the job doesn’t go to the other guy.' },
      { kicker: 'Use case', head: 'Maintenance, booked.', sub: 'Tune-ups scheduled, every due customer reminded.' },
      { kicker: 'Use case', head: 'Service calls, handled.', sub: 'Logged, scheduled, confirmed the day before.' },
      { kicker: 'Use case', head: 'A job board that builds itself.', sub: 'Every job & estimate logged from email and texts.' },
      { head: 'Drafted for you.', sub: 'Nothing sends without your OK.', accent: 'Nothing sends without your OK.' },
      { head: 'More jobs booked. Fewer dead estimates.', sub: 'One install covers years of it.', accent: 'One install covers years of it.' },
      { finale: true },
    ],
    tagIntro: 'The AI assistant with a brain for HVAC.',
  },

  accounting: {
    label: 'accountants',
    lines: [
      "Deadlines don't wait for you to catch up on email. And in your world, the dates are everything.", // 0
      "Generic AI doesn't know a 1099 from a K-1. It's a blank box, waiting on you.", // 1
      "Jordyn is different. It arrives already fluent in accounting — filings, deadlines, and client documents.", // 2
      "Tax season? Jordyn chases the missing documents from every client — automatically, until they arrive.", // 3
      "Deadline approaching? Jordyn flags each filing and extension well before the date.", // 4
      "New engagement? Jordyn drafts the letter, opens the file, and sets the recurring reminders.", // 5
      "Every client, document, and pending item recorded from your inbox, automatically.", // 6
      "It drafts your client emails and reminders — and nothing sends without your okay.", // 7
      "That's a calmer close, and no client left chasing you. One retained client covers years of it.", // 8
      "Jordyn. The AI assistant with a brain for accounting.", // 9
    ],
    scenes: [
      `${STYLE} A friendly accountant character (terracotta blazer) at a desk with soft floating tax forms, receipts, and a calculator shape, focused but a little buried, warm.`,
      `${STYLE} An accountant looking uncertain at a large empty rounded chat panel with a blinking cursor, a subtle question mark, minimal.`,
      `${STYLE} A warm glowing terracotta 'brain' orb radiating rays surrounded by soft flat accounting icons — a calculator, a document, a percent sign, a calendar — assembling, no character.`,
      `${STYLE} A flat 'chase missing documents' concept — a checklist of document icons, some missing with a soft reminder arrow, others arriving with checkmarks, no readable text.`,
      `${STYLE} A flat filing-deadline concept — a calendar with clear deadline flags and a soft clock, a document with a percent motif, no readable text.`,
      `${STYLE} A flat new-engagement concept — an engagement letter, a new file folder, and a recurring-reminder loop icon, warm accents, no readable text.`,
      `${STYLE} A self-building client list of soft rounded client cards flowing into tidy columns, a small calculator motif, sage and gold accents, no character, no readable text.`,
      `${STYLE} An accountant reviewing a nicely formatted client email the assistant drafted, an approval checkmark and pen, pleased.`,
      `${STYLE} A calm 'a calmer close' concept — a clock with sparkles and a gentle downward-stress / upward-calm chart, warm, no character, no readable text.`,
      `${STYLE} A confident accountant standing calmly holding a tablet, soft sage leaf shapes in a rounded frame behind, self-assured, generous empty cream space lower-center for a logo, finale.`,
    ],
    captions: [
      { head: 'In your world, the dates are everything.', small: true },
      { head: 'Generic AI knows nothing about accounting.', small: true },
      { logoHead: 'knows accounting.', sub: 'Filings, deadlines, client documents.' },
      { kicker: 'Use case', head: 'Missing docs, chased.', sub: 'Every client followed up — until it all arrives.' },
      { kicker: 'Use case', head: 'Filings, flagged early.', sub: 'Every deadline and extension, well before the date.' },
      { kicker: 'Use case', head: 'Engagements, opened.', sub: 'Letter drafted, file opened, reminders set.' },
      { kicker: 'Use case', head: 'A client list that builds itself.', sub: 'Every client and pending item logged from email.' },
      { head: 'Drafted in your voice.', sub: 'Nothing sends without your OK.', accent: 'Nothing sends without your OK.' },
      { head: 'A calmer close. Nobody chasing you.', sub: 'One retained client covers years of it.', accent: 'One retained client covers years of it.' },
      { finale: true },
    ],
    tagIntro: 'The AI assistant with a brain for accounting.',
  },

  dental: {
    label: 'dental practices',
    lines: [
      "An empty chair is lost revenue. But keeping the schedule full is a full-time job by itself.", // 0
      "Generic AI doesn't know a recall from a root canal. It's a blank box, waiting on you.", // 1
      "Jordyn is different. It arrives already fluent in your practice — recalls, treatment plans, and scheduling.", // 2
      "Chair open tomorrow? Jordyn fills it — reaching out to patients who are due, until it's booked.", // 3
      "Recall time? Jordyn reminds every patient whose cleaning or check-up is due, automatically.", // 4
      "Treatment plan pending? Jordyn follows up so accepted care actually gets scheduled.", // 5
      "Every patient, appointment, and pending plan tracked from your inbox, automatically.", // 6
      "It drafts your patient reminders and messages — and nothing sends without your okay.", // 7
      "That's a fuller schedule and fewer no-shows. One filled chair a day covers years of it.", // 8
      "Jordyn. The AI assistant with a brain for dental.", // 9
    ],
    scenes: [
      `${STYLE} A friendly dental office manager character (terracotta top) at a front desk with soft floating appointment cards and a calendar, a tooth motif, busy but warm.`,
      `${STYLE} A dental office manager looking uncertain at a large empty rounded chat panel with a blinking cursor, a subtle question mark, minimal.`,
      `${STYLE} A warm glowing terracotta 'brain' orb radiating rays surrounded by soft flat dental icons — a tooth, a calendar, a checkup mirror, a reminder bell — assembling, no character.`,
      `${STYLE} A flat 'fill the chair' concept — a calendar with an open slot being filled, soft patient/message icons reaching out, a checkmark when booked, no readable text.`,
      `${STYLE} A flat recall-reminder concept — a tooth icon, a calendar, and gentle reminder bells going out to several patient shapes, warm, no readable text.`,
      `${STYLE} A flat treatment-plan concept — a treatment plan document with a soft follow-up arrow and a scheduled-appointment checkmark, no readable text.`,
      `${STYLE} A self-building patient schedule of soft rounded appointment cards flowing into a tidy calendar, a small tooth motif, sage and gold accents, no character, no readable text.`,
      `${STYLE} A dental office manager reviewing a nicely formatted patient reminder the assistant drafted, an approval checkmark, pleased.`,
      `${STYLE} A calm 'fuller schedule' concept — a clock with sparkles and a full calendar with a rising chart, warm, no character, no readable text.`,
      `${STYLE} A confident dental practice owner standing calmly holding a tablet, soft sage leaf shapes in a rounded frame behind, self-assured, generous empty cream space lower-center for a logo, finale.`,
    ],
    captions: [
      { head: 'An empty chair is lost revenue.', sub: 'Keeping the schedule full is its own full-time job.' },
      { head: 'Generic AI knows nothing about your practice.', small: true },
      { logoHead: 'knows dental.', sub: 'Recalls, treatment plans, scheduling.' },
      { kicker: 'Use case', head: 'Open chairs, filled.', sub: 'Reaching due patients until the slot is booked.' },
      { kicker: 'Use case', head: 'Recalls, on autopilot.', sub: 'Every due cleaning and check-up, reminded.' },
      { kicker: 'Use case', head: 'Treatment plans, followed up.', sub: 'So accepted care actually gets scheduled.' },
      { kicker: 'Use case', head: 'A schedule that builds itself.', sub: 'Every patient and plan tracked from your inbox.' },
      { head: 'Drafted for you.', sub: 'Nothing sends without your OK.', accent: 'Nothing sends without your OK.' },
      { head: 'Fuller schedule. Fewer no-shows.', sub: 'One filled chair a day covers years of it.', accent: 'One filled chair a day covers years of it.' },
      { finale: true },
    ],
    tagIntro: 'The AI assistant with a brain for dental.',
  },

  government: {
    label: 'government agencies',
    lines: [
      "Public service runs on deadlines and records. And the requests never stop coming.", // 0
      "Generic AI doesn't know an RFP from an FOIA. It's a blank box, waiting on you.", // 1
      "Jordyn is different. It arrives already fluent in public-sector work — records, requests, and deadlines.", // 2
      "Records request come in? Jordyn logs it, tracks the response clock, and flags it before it's late.", // 3
      "RFP or solicitation? Jordyn organizes the responses and keeps every submission deadline in view.", // 4
      "Constituent email? Jordyn drafts a clear, on-record reply — routed for your approval.", // 5
      "Every request, case, and deadline recorded from your inbox, with a full audit trail.", // 6
      "It drafts your correspondence — on the record, and nothing sends without your okay.", // 7
      "That's requests answered on time and a clean audit trail — without the overtime.", // 8
      "Jordyn. The AI assistant with a brain for government.", // 9
    ],
    scenes: [
      `${STYLE} A friendly public-sector professional character (terracotta blazer) at a desk with soft floating official documents, forms, and envelopes, a subtle government/civic motif, warm.`,
      `${STYLE} A public-sector professional looking uncertain at a large empty rounded chat panel with a blinking cursor, a subtle question mark, minimal.`,
      `${STYLE} A warm glowing terracotta 'brain' orb radiating rays surrounded by soft flat civic icons — a document, a stamp, a calendar, a small classical-building/pillars shape — assembling, no character.`,
      `${STYLE} A flat records-request concept — a request document, a response clock/timer, and a deadline flag, orderly, no readable text.`,
      `${STYLE} A flat RFP concept — several proposal documents organized into a tidy stack with a calendar of submission deadlines, no readable text.`,
      `${STYLE} A flat constituent-reply concept — an incoming envelope and a drafted reply document with an approval routing arrow, no readable text.`,
      `${STYLE} A self-building request log of soft rounded case cards flowing into tidy columns with a small audit-trail motif, sage and gold accents, no character, no readable text.`,
      `${STYLE} A public-sector professional reviewing a nicely formatted official reply the assistant drafted, an approval checkmark, pleased.`,
      `${STYLE} A calm 'on time, on record' concept — a clock with sparkles and a checkmark on a document with a small audit-trail line, warm, no character, no readable text.`,
      `${STYLE} A confident public-sector professional standing calmly holding a tablet, soft sage leaf shapes in a rounded frame behind, self-assured, generous empty cream space lower-center for a logo, finale.`,
    ],
    captions: [
      { head: 'Deadlines and records. Requests that never stop.', small: true },
      { head: 'Generic AI knows nothing about public-sector work.', small: true },
      { logoHead: 'knows government.', sub: 'Records, requests, and deadlines.' },
      { kicker: 'Use case', head: 'Records requests, tracked.', sub: 'The response clock watched, flagged before it’s late.' },
      { kicker: 'Use case', head: 'RFPs, organized.', sub: 'Responses gathered, every deadline in view.' },
      { kicker: 'Use case', head: 'Constituents, answered.', sub: 'A clear, on-record reply — routed for approval.' },
      { kicker: 'Use case', head: 'A request log that builds itself.', sub: 'Every request recorded, with a full audit trail.' },
      { head: 'On the record.', sub: 'Nothing sends without your OK.', accent: 'Nothing sends without your OK.' },
      { head: 'On time. Clean audit trail. No overtime.', sub: 'Public service, without the backlog.', accent: 'without the backlog.' },
      { finale: true },
    ],
    tagIntro: 'The AI assistant with a brain for government.',
  },

  consulting: {
    label: 'consultants',
    lines: [
      "You bill for expertise, not admin. So why does the admin eat your best hours?", // 0
      "Generic AI doesn't know a SOW from a retainer. It's a blank box, waiting on you.", // 1
      "Jordyn is different. It arrives already fluent in your practice — proposals, engagements, and deliverables.", // 2
      "New prospect? Jordyn drafts the proposal and the statement of work — in your voice, ready to send.", // 3
      "Engagement kicking off? Jordyn tracks milestones and nudges the client for what you're waiting on.", // 4
      "Deliverable due? Jordyn flags the deadline and sends the status update before they ask.", // 5
      "Every client, engagement, and open item recorded from your inbox, automatically.", // 6
      "It drafts your proposals and updates — and nothing sends without your okay.", // 7
      "That's more time on the work clients pay for. One engagement covers years of it.", // 8
      "Jordyn. The AI assistant with a brain for consulting.", // 9
    ],
    scenes: [
      `${STYLE} A friendly consultant character (terracotta blazer) at a desk with soft floating proposal documents, a chart, and envelopes, professional, warm.`,
      `${STYLE} A consultant looking uncertain at a large empty rounded chat panel with a blinking cursor, a subtle question mark, minimal.`,
      `${STYLE} A warm glowing terracotta 'brain' orb radiating rays surrounded by soft flat consulting icons — a proposal document, a chart, a handshake, a milestone flag — assembling, no character.`,
      `${STYLE} A flat proposal/SOW concept — a polished proposal document and a statement-of-work page with a soft 'ready to send' arrow, warm accents, no readable text.`,
      `${STYLE} A flat engagement-milestones concept — a timeline with milestone flags and a gentle client-nudge arrow, no readable text.`,
      `${STYLE} A flat deliverable concept — a document with a deadline flag and a status-update message going out, no readable text.`,
      `${STYLE} A self-building engagement list of soft rounded client cards flowing into tidy columns, a small chart motif, sage and gold accents, no character, no readable text.`,
      `${STYLE} A consultant reviewing a nicely formatted proposal the assistant drafted on a tablet, an approval checkmark, pleased.`,
      `${STYLE} A calm 'more time on real work' concept — a clock with sparkles and a rising chart, warm, no character, no readable text.`,
      `${STYLE} A confident consultant standing calmly holding a tablet, soft sage leaf shapes in a rounded frame behind, self-assured, generous empty cream space lower-center for a logo, finale.`,
    ],
    captions: [
      { head: 'You bill for expertise, not admin.', sub: 'So why does admin eat your best hours?' },
      { head: 'Generic AI knows nothing about your practice.', small: true },
      { logoHead: 'knows consulting.', sub: 'Proposals, engagements, deliverables.' },
      { kicker: 'Use case', head: 'Proposals, drafted.', sub: 'The SOW too — in your voice, ready to send.' },
      { kicker: 'Use case', head: 'Milestones, tracked.', sub: 'Clients nudged for what you’re waiting on.' },
      { kicker: 'Use case', head: 'Status updates, sent.', sub: 'Deadlines flagged — before they ask.' },
      { kicker: 'Use case', head: 'An engagement list that builds itself.', sub: 'Every client and open item logged from email.' },
      { head: 'Drafted in your voice.', sub: 'Nothing sends without your OK.', accent: 'Nothing sends without your OK.' },
      { head: 'More time on the work they pay for.', sub: 'One engagement covers years of it.', accent: 'One engagement covers years of it.' },
      { finale: true },
    ],
    tagIntro: 'The AI assistant with a brain for consulting.',
  },

  retail: {
    label: 'retail',
    lines: [
      "You're running the floor, the stock, and the staff. The back-office never sleeps.", // 0
      "Generic AI doesn't know a SKU from a supplier. It's a blank box, waiting on you.", // 1
      "Jordyn is different. It arrives already fluent in retail — orders, suppliers, and customers.", // 2
      "Reorder time? Jordyn drafts the purchase order and follows up with the supplier on delivery.", // 3
      "Customer inquiry? Jordyn drafts a friendly reply and logs it — so nothing slips.", // 4
      "Promotion coming? Jordyn preps the announcement and the customer emails — in your voice.", // 5
      "Every order, supplier, and customer thread recorded from your inbox, automatically.", // 6
      "It drafts your supplier and customer messages — and nothing sends without your okay.", // 7
      "That's less time in the back office, more on the floor. It pays for itself in a single week.", // 8
      "Jordyn. The AI assistant with a brain for retail.", // 9
    ],
    scenes: [
      `${STYLE} A friendly shop owner character (terracotta apron) in a warm boutique with soft floating order forms, boxes, and a small storefront motif, busy, warm.`,
      `${STYLE} A shop owner looking uncertain at a large empty rounded chat panel with a blinking cursor, a subtle question mark, minimal.`,
      `${STYLE} A warm glowing terracotta 'brain' orb radiating rays surrounded by soft flat retail icons — a shopping bag, a box, a tag, a storefront — assembling, no character.`,
      `${STYLE} A flat purchase-order concept — an order document and a delivery box with a soft supplier follow-up arrow, warm accents, no readable text.`,
      `${STYLE} A flat customer-inquiry concept — an incoming message and a friendly drafted reply with a logged checkmark, no readable text.`,
      `${STYLE} A flat promotion concept — a sale tag and soft announcement emails flowing out to customer shapes, tan and sage accents, no readable text.`,
      `${STYLE} A self-building order & customer log of soft rounded cards flowing into tidy columns, a small shopping-bag motif, sage and gold accents, no character, no readable text.`,
      `${STYLE} A shop owner reviewing a nicely formatted customer message the assistant drafted on a tablet, an approval checkmark, pleased.`,
      `${STYLE} A calm 'more time on the floor' concept — a clock with sparkles and a rising sales chart, a small storefront badge, warm, no character, no readable text.`,
      `${STYLE} A confident shop owner standing calmly in the storefront holding a tablet, soft sage leaf shapes in a rounded frame behind, self-assured, generous empty cream space lower-center for a logo, finale.`,
    ],
    captions: [
      { head: 'The floor, the stock, the staff.', sub: 'The back office never sleeps.' },
      { head: 'Generic AI knows nothing about your shop.', small: true },
      { logoHead: 'knows retail.', sub: 'Orders, suppliers, customers.' },
      { kicker: 'Use case', head: 'Reorders, handled.', sub: 'PO drafted, the supplier chased on delivery.' },
      { kicker: 'Use case', head: 'Inquiries, answered.', sub: 'A friendly reply drafted — and logged, so nothing slips.' },
      { kicker: 'Use case', head: 'Promotions, launched.', sub: 'Announcements and emails, in your voice.' },
      { kicker: 'Use case', head: 'A log that builds itself.', sub: 'Every order and customer thread, from your inbox.' },
      { head: 'Drafted for you.', sub: 'Nothing sends without your OK.', accent: 'Nothing sends without your OK.' },
      { head: 'Less back office. More floor.', sub: 'It pays for itself in a single week.', accent: 'It pays for itself in a single week.' },
      { finale: true },
    ],
    tagIntro: 'The AI assistant with a brain for retail.',
  },
}
