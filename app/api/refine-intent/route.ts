import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const runtime = 'nodejs'

let _openai: OpenAI | null = null
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  return _openai
}

export async function POST(request: Request) {
  const { intentType, answers, questions } = await request.json()

  const qaPairs = questions.map((q: string, i: number) => `Q: ${q}\nA: ${answers[i] || 'not answered'}`).join('\n')

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `Based on these answers, write a clear 1-2 sentence description of what video this person wants to create. Be specific and actionable.

Intent type: ${intentType}
${qaPairs}

Return ONLY the purpose statement, nothing else. Example: "Create a sales pitch video for insurance agents that highlights our 10x faster annuity processing and drives them to schedule a demo."`,
    }],
    temperature: 0.5,
    max_tokens: 200,
  })

  const purpose = response.choices[0]?.message?.content?.trim() ?? answers.join('. ')

  return NextResponse.json({ purpose })
}
