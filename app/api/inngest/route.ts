import { serve } from 'inngest/next'
import { inngest } from '../../_lib/inngest/client'
import { renderVideoV2 } from '../../_lib/inngest/render-video'

export const runtime = 'nodejs'
export const maxDuration = 300

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [renderVideoV2],
})
