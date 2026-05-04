import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { logUsage } from '@/lib/usage-tracker'

type Provider = 'anthropic' | 'openai' | 'gemini'

interface ProviderResult {
  text: string
  inputTokens: number
  outputTokens: number
}

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
}

const SYSTEM_PROMPT = `You are a digital marketing strategist specializing in masterclass launches on Instagram and WhatsApp.

Given details about a masterclass, create a day-by-day marketing strategy from 14 days before the event to 1 day after.

Return ONLY valid JSON (no markdown fences):
{
  "summary": "1-2 sentence overview of the overall strategy",
  "days": [
    {
      "daysBeforeEvent": 14,
      "label": "2 weeks before",
      "activities": [
        {
          "platform": "instagram",
          "type": "Post",
          "content": "Caption text / activity description (3-5 sentences, ready to use)",
          "timing": "10:00 AM"
        },
        {
          "platform": "whatsapp",
          "type": "Broadcast",
          "content": "WhatsApp message text (conversational, include emojis)",
          "timing": "7:00 PM"
        }
      ]
    }
  ]
}

Platform activity types:
- Instagram: Post, Story, Reel, Q&A Story, Countdown Sticker, Poll Story, Close Friends Story
- WhatsApp: Broadcast, Status, Community Announcement
- Email: Newsletter (include if relevant)

Strategy structure:
- D-14: Initial announcement across platforms
- D-10: Value teaser (share a key insight from the masterclass)
- D-7: Social proof (past results / testimonials theme)
- D-5: FAQ / objection handling
- D-3: Early bird urgency (if applicable)
- D-2: Last call reminder
- D-1: Final reminder + event logistics
- D-0: Event day hype + live updates
- D+1: Thank you + replay / next steps

Make content specific to the masterclass topic. Include actual caption text, not just descriptions.`

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

async function callAnthropic(prompt: string, model: string): Promise<ProviderResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model,
    max_tokens: 5000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('No text from Claude')
  return { text: block.text, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
}

async function callOpenAI(prompt: string, model: string): Promise<ProviderResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
      max_tokens: 5000,
      temperature: 0.7,
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`)
  const data = await res.json()
  return {
    text: data.choices[0].message.content as string,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  }
}

async function callGemini(prompt: string, model: string): Promise<ProviderResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const geminiModel = genAI.getGenerativeModel({ model, systemInstruction: SYSTEM_PROMPT })
  const result = await geminiModel.generateContent(prompt)
  const meta = result.response.usageMetadata
  return {
    text: result.response.text(),
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
  }
}

export async function POST(req: NextRequest) {
  const {
    title, description, targetAudience, keyTopics, date, price, provider: reqProvider, model: reqModel,
  }: {
    title: string
    description: string
    targetAudience?: string
    keyTopics?: string
    date?: string
    price?: number
    provider?: string
    model?: string
  } = await req.json()

  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const provider = (reqProvider ?? 'gemini') as Provider
  const model = reqModel ?? DEFAULT_MODELS[provider]

  const keyMap: Record<Provider, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  }
  if (!keyMap[provider]) return NextResponse.json({ error: `API key not set for ${provider}` }, { status: 500 })

  const userPrompt = [
    `Masterclass Title: ${title}`,
    description ? `Description: ${description}` : '',
    targetAudience ? `Target Audience: ${targetAudience}` : '',
    keyTopics ? `Key Topics: ${keyTopics}` : '',
    date ? `Event Date: ${new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}` : '',
    price ? `Price: ₹${price}` : 'Free event',
  ].filter(Boolean).join('\n')

  try {
    const callers: Record<Provider, () => Promise<ProviderResult>> = {
      anthropic: () => callAnthropic(userPrompt, model),
      openai: () => callOpenAI(userPrompt, model),
      gemini: () => callGemini(userPrompt, model),
    }
    const result = await callers[provider]()

    await logUsage({ timestamp: new Date().toISOString(), provider, model, feature: 'masterclass-strategy', inputTokens: result.inputTokens, outputTokens: result.outputTokens })

    const strategy = JSON.parse(stripJsonFences(result.text))
    return NextResponse.json({ strategy })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg.includes('JSON') ? 'AI returned invalid JSON — try again' : msg }, { status: 500 })
  }
}
