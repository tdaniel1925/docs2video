# PrismGraphs — UX Design Brief (Light Theme Only)

## Brand Identity
- **Name**: PrismGraphs
- **Tagline**: "Turn Illustrations Into Stunning Infographics"
- **Target User**: Life insurance agents (not tech-savvy, need things simple and clear)
- **Brand Colors**: Gradient accent from blue (#4A90D9) to purple (#7B61FF). Primary backgrounds are white/light gray. Text is dark charcoal (#1E293B).
- **Typography**: Clean sans-serif (Inter or similar). Professional, not playful.
- **Tone**: Premium but approachable. Think "modern financial SaaS" — not startup, not corporate.

---

## Global Design Rules
- **Light theme ONLY** — white/off-white backgrounds, light gray cards, dark text
- All pages should have generous whitespace
- Cards with subtle shadows (no heavy borders)
- Rounded corners (12-16px radius)
- Accent colors used sparingly for CTAs and highlights
- Mobile responsive but desktop-first (agents mostly use desktop)
- No decorative illustrations — let the generated content be the visual hero

---

## Screen 1: Landing Page (`/`)

### Purpose
Convert visitors into signups. Show what the product does in 5 seconds.

### Layout (top to bottom)
1. **Top Nav Bar**
   - Left: PrismGraphs logo (text-based, gradient blue-purple)
   - Right: "Sign In" text link + "Get Started" filled button (blue)
   - Clean white background, subtle bottom border

2. **Hero Section** (centered, lots of vertical space)
   - Large headline (48-56px): "Turn Illustrations Into Stunning Infographics"
   - Subheadline (18px, gray): "Upload your life insurance illustration PDF and get a professional, branded infographic in seconds. Impress your clients with clear, beautiful policy summaries."
   - Two buttons side by side:
     - "Start Free Trial" (filled blue, large)
     - "Sign In" (outlined, large)
   - Below buttons: small gray text "10 free infographics — no credit card required"

3. **Feature Cards** (3-column grid)
   - Each card: icon area (colored circle with simple icon), title (bold), description (gray)
   - Card 1: "Upload PDF" — "Drop any life insurance illustration PDF. We support all major carriers and policy types."
   - Card 2: "AI Extraction" — "Our AI reads your illustration and extracts key data: death benefit, premiums, cash values, riders, and more."
   - Card 3: "Branded Output" — "Get a professional infographic or narrated video explainer styled with your brand colors and logo."

4. **Footer**
   - Minimal. Copyright line centered. Light gray background.

---

## Screen 2: Sign Up (`/signup`)

### Purpose
Account creation. Must feel fast and simple.

### Layout
- Centered card on a light gray background (full page height)
- Card width: ~420px
- Top of card: PrismGraphs logo (gradient text)
- Below logo: "Create your account" in gray
- Form fields (stacked, full width within card):
  - Full Name (text input)
  - Email (email input)
  - Password (password input, "At least 6 characters" placeholder)
- Submit button: "Create Account" (full width, blue, large)
- Below button: "Already have an account? Sign in" link
- All inputs: light gray background (#F8FAFC), 1px border (#E2E8F0), dark text, rounded (8px)
- Error state: red text below affected field, light red background on input

---

## Screen 3: Login (`/login`)

### Purpose
Quick sign in.

### Layout
- Same centered card layout as signup
- PrismGraphs logo
- "Sign in to your account"
- Email + Password fields
- "Sign In" button (full width, blue)
- Below: "Forgot password?" link + "Don't have an account? Sign up" link
- Error state: red banner inside card with error message

---

## Screen 4: Dashboard (`/dashboard`)

### Purpose
Home base. Show stats, recent work, and quick action.

### Layout
1. **Top Header** (persistent on all dashboard pages)
   - Left: PrismGraphs logo
   - Center: Nav links — Dashboard, Create, Gallery, Brands, Videos
   - Right: User avatar circle (initials) + dropdown on click (Settings, Sign Out, credits count)
   - White background, subtle bottom shadow

2. **Page Content**
   - Page title: "Dashboard" (large, bold, left-aligned)
   - Subtitle: "Create professional infographics from your illustrations"
   - Right-aligned: "+ New Infographic" button (blue, filled)

3. **Stats Row** (3 cards, horizontal)
   - Card 1: "Credits Remaining" — large blue number
   - Card 2: "Total Infographics" — large purple number
   - Card 3: "Plan" — "Trial" in green
   - Each card: white background, subtle shadow, rounded, icon or colored accent bar on left

4. **Recent Infographics** section
   - Section header: "Recent Infographics" with "View all" link on right
   - Grid: 3 columns
   - Each item: thumbnail (aspect 9:16 for portrait, 16:9 for landscape), title below, date below that
   - Hover: subtle scale-up on thumbnail, blue border highlight
   - Empty state: dashed border container, "No infographics yet" message + "Create Your First" button

---

## Screen 5: Create Page (`/create`)

### Purpose
The main creation flow. Multi-step wizard. This is the most important screen.

### Layout — Step-based wizard with progress indicator at top

**Progress Bar** (always visible during flow)
- Horizontal steps with dots and connecting lines
- Steps change based on output type:
  - Infographic: Upload → Extract → Review → Options → Generate
  - Video: Upload → Extract → Review → Style → Slides → Voice → Generate
- Active step: blue filled dot
- Completed: blue dot with checkmark
- Upcoming: gray outlined dot

---

### Step: Upload
- Large drop zone (dashed border, light gray background, rounded 16px)
- Center content:
  - PDF icon (large, gray)
  - "Drop your insurance illustration here" (medium text)
  - "or" small text
  - "Choose File" button (outlined)
- After file selected:
  - Show filename, file size
  - "Change File" (outlined) + "Extract Data" (blue filled) buttons

### Step: Review Extracted Data
- Card with all extracted fields in a 2-3 column grid:
  - Policy Type, Carrier, Insured, Death Benefit (green), Annual Premium (blue), Payment Mode
- Cash value projections table (if available)
- Riders shown as rounded pills/tags
- "Continue" button at bottom

### Step: Choose Output + Brand
- **Brand Selection**
  - Section title: "Select Brand"
  - Grid of brand cards (2-3 columns)
  - Each card: brand name, color swatches (4 small circles)
  - Selected state: blue border + light blue background
  - "Create one" link if no brands exist

- **Output Type** (below brand selection)
  - Two large cards side by side:
    - Left card: image icon, "Infographic", "Static branded image", "1 credit" in blue
    - Right card: video icon, "Video Explainer", "4-5 min narrated video", "2 credits" in purple
  - Selected state: matching color border + tinted background

- **If Infographic selected**: Show page size picker below (Portrait/Landscape with visual rectangles)
- Bottom: "Back" (outlined) + "Generate Infographic" or "Choose Slide Style" button

### Step: Choose Style (video only)
- Section title: "Choose Your Slide Style"
- 2x2 grid of style preview cards:
  - Each card: preview thumbnail (16:9 aspect), style name below, description below
  - Styles: Modern (dark/gradient), Classic (light/elegant), Bold (vibrant), Clean (minimal white)
  - Selected: colored border + ring glow
- "Back" + "Generate Slides" buttons

### Step: Approve Slides (video only)
- Section title: "Preview & Approve Slides"
- Subtitle: "Review each slide. Regenerate any you don't like."
- Slide count indicator: "8 slides generated"
- 2-column grid of slide cards:
  - Each card: slide thumbnail (16:9), below it: slide title, truncated description, "Redo" button
  - Loading state: spinner + "Generating slide N..."
  - Failed state: red text "Failed — click Redo"
  - Slides generate one-by-one, so user sees them appear progressively
- "Back" + "Choose Voice" button (disabled until all slides ready)

### Step: Choose Voice (video only)
- Section title: "Choose Narration Voice"
- 2x3 grid of voice cards:
  - Each card: name (Sarah, Emily, James, etc.), gender tag, description
  - Below: "▶ Preview" button that plays a short audio sample INSTANTLY (pre-cached MP3)
  - Playing state: pulsing purple dot + "Playing..."
  - Selected: purple border + tinted background
- "Back" + "Generate Video" (purple) buttons

### Step: Generating
- Centered card with spinner
- Text: "Generating your infographic..." or "Starting video generation..."
- Subtitle with context

---

## Screen 6: Infographic Detail (`/infographics/[id]`)

### Purpose
View, download, and create video from a completed infographic.

### Layout
- Back link: "← Back to Gallery"
- Title (large), source PDF name + date below
- Action buttons (right-aligned):
  - "Create Video Explainer" (purple, filled)
  - "Download PNG" (blue, filled)
  - "Delete" (red outlined, small)
- Main content: infographic image centered, max-width ~500px, white card with shadow
- Processing state: spinner + "Still generating..."
- Failed state: red banner with error message + "Try Again" link

---

## Screen 7: Gallery (`/infographics`)

### Purpose
Browse all generated infographics.

### Layout
- Title: "Gallery", subtitle: "All your generated infographics"
- "+ New Infographic" button (right-aligned)
- Grid: 3-4 columns
- Each card: thumbnail, title, date
- Hover: scale-up, blue border
- Empty state: dashed border + "Create Your First" CTA

---

## Screen 8: Video Detail (`/videos/[id]`)

### Purpose
Watch video, see progress, download/share.

### Progress State (when generating)
- Card with:
  - **Progress bar** at top: gradient blue-purple fill, percentage on right
  - **Current step highlight**: bordered card with spinner + step name + description
  - **Step checklist** below: numbered list with checkmarks for completed, pulse dot for active, gray for pending
  - Steps: Writing Script → Generating Audio → Creating Slides → Assembling Video
  - Footer text: "Typically takes 45-90 seconds. This page updates automatically."

### Completed State
- **Branded video player**:
  - Header bar in brand primary color: brand logo/name on left, video title on right
  - Video element with poster/thumbnail
  - Play button overlay (centered, semi-transparent circle)
  - Bottom controls: play/pause button, progress bar (brand secondary color), time display
- Action buttons: "Copy Share Link" (outlined), "Download MP4" (blue filled), "Delete" (red outlined)

---

## Screen 9: Videos Gallery (`/videos`)

### Purpose
Browse all generated videos.

### Layout
- Title: "Videos", subtitle: "Your generated video explainers"
- Grid: 3 columns
- Each card: 16:9 thumbnail with play button overlay + duration badge (bottom-right)
- Processing cards: spinner instead of thumbnail, status text
- Title + date below thumbnail

---

## Screen 10: Public Watch Page (`/watch/[id]`)

### Purpose
Shareable video page — no login required. Client-facing.

### Layout
- Full page, centered vertically
- Background: brand background color (or neutral off-white)
- Branded video player (same as video detail but standalone)
- Below player: "Powered by PrismGraphs" in small gray text with gradient logo
- NO navigation, NO header — this is a standalone share page

---

## Screen 11: Brand Management (`/brands`)

### Purpose
CRUD for brand profiles.

### List View
- Title: "Brands", "+ New Brand" button
- Grid: 3 columns
- Each card: logo/initial avatar, brand name, default badge (if applicable), 4 color swatch circles
- Click → edit page

### Create/Edit View (`/brands/new`, `/brands/[id]`)
- Form card (max-width ~640px)
- Fields:
  - Brand Name (text input)
  - Logo URL (url input, optional)
  - 5 color pickers in a row: Primary, Secondary, Accent, Background, Text
  - Each picker: native color input + hex value display
- **Live Preview** below color pickers:
  - A mini card showing how the colors look together (colored sections labeled Primary, Secondary, Accent)
- "Set as default brand" checkbox
- "Create Brand" or "Save Changes" button
- Edit page also has "Delete" button (red outlined, top-right)

---

## Screen 12: Settings (`/settings`)

### Purpose
Profile management.

### Layout
- Title: "Settings"
- **Profile card**:
  - Email (read-only, grayed out)
  - Full Name (editable)
  - Company Name (editable)
  - "Save Changes" button + green "Saved!" toast on success
- **Subscription card** below:
  - Current plan name + credits remaining
  - (Future: upgrade button)

---

## Component Library Notes for Designer

### Buttons
- **Primary**: Blue (#4A90D9) filled, white text, rounded 8px, hover: darker blue
- **Secondary/Video**: Purple (#7B61FF) filled, white text
- **Outlined**: 1px border, transparent bg, hover: light fill
- **Danger**: Red outlined, red text, hover: light red bg
- **Disabled**: 50% opacity, no hover

### Inputs
- Background: #F8FAFC
- Border: 1px #E2E8F0, focus: blue border + blue ring
- Rounded: 8px
- Padding: 12px 16px
- Label above in gray, small

### Cards
- Background: white
- Shadow: `0 1px 3px rgba(0,0,0,0.08)`
- Border: 1px #F1F5F9 (very subtle)
- Rounded: 12-16px
- Hover (if clickable): slightly stronger shadow + border color change

### Status Badges
- Processing: blue dot + "Processing"
- Completed: green checkmark
- Failed: red dot + "Failed"

### Empty States
- Dashed border container
- Gray icon/text centered
- CTA button below

### Toasts/Alerts
- Error: light red bg, red text, red border
- Success: light green bg, green text
- Info: light blue bg

### Page Background
- #FAFBFC (very subtle off-white, not pure white)
