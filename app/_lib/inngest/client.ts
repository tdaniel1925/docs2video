import { Inngest } from 'inngest'

// Pipeline v2 job orchestration. Local dev: `npx inngest-cli dev` (no account
// needed). Production: set INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY in Vercel.
export const inngest = new Inngest({ id: 'docs2video' })
