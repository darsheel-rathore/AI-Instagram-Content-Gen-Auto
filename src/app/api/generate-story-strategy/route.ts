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

const SYSTEM_PROMPT = `You are a social media content strategist specializing in Instagram Stories, WhatsApp Status, and Email campaigns for creators and coaches.

Given details about a weekly story campaign, generate a day-by-day strategy for all 7 days (Monday to Sunday).

Return ONLY valid JSON (no markdown fences):
{
  "summary": "1-2 sentence overview of the week's campaign goal",
  "weekTheme": "short theme title for the week (e.g. 'Trust Building Week')",
  "days": [
    {
      "dayOfWeek": "Monday",
      "label": "Week Opener",
      "activities": [
        {
          "platform": "instagram",
          "type": "Q&A Story",
          "content": "Ready-to-use story content / question / caption (2-4 sentences)",
          "timing": "10:00 AM"
        },
        {
          "platform": "whatsapp",
          "type": "Status",
          "content": "WhatsApp status text (conversational, include 1-2 emojis)",
          "timing": "11:00 AM"
        }
      ]
    }
  ]
}

Instagram story types: Q&A, Poll, Quiz, Countdown, Behind the Scenes, Live Teaser, Testimonial, Tutorial, Product Showcase, Swipe Up, Close Friends, Announcement
WhatsApp types: Status, Broadcast, Community Update
Email types: Newsletter, Nurture Email, Announcement

Day-by-day structure:
- Monday: Attention-grabbing opener, set the week's theme, create curiosity
- Tuesday: Value content — tips, insights, or a mini-tutorial
- Wednesday: High engagement — Q&A, Poll, or Quiz story to involve the audience
- Thursday: Social proof — testimonial, result, or case study
- Friday: Behind the scenes — personal story, your journey, or process
- Saturday: Promotional / call to action — offer, product, or event push
- Sunday: Recap + tease next week — keep audience looking forward

Make all content specific to the campaign topic. Write actual captions and messages, not generic descriptions. Include relevant emojis naturally.`

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
    title, description, targetAudience, weekStart, customPrompt, provider: reqProvider, model: reqModel,
  }: {
    title: string
    description?: string
    targetAudience?: string
    weekStart?: string
    customPrompt?: string
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
    `Campaign Title: ${title}`,
    description ? `Description: ${description}` : '',
    targetAudience ? `Target Audience: ${targetAudience}` : '',
    weekStart ? `Week Starting: ${new Date(weekStart).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}` : '',
    customPrompt ? `Additional Instructions: ${customPrompt}` : '',
  ].filter(Boolean).join('\n')

  try {
    const callers: Record<Provider, () => Promise<ProviderResult>> = {
      anthropic: () => callAnthropic(userPrompt, model),
      openai: () => callOpenAI(userPrompt, model),
      gemini: () => callGemini(userPrompt, model),
    }
    const result = await callers[provider]()

    await logUsage({ timestamp: new Date().toISOString(), provider, model, feature: 'story-strategy', inputTokens: result.inputTokens, outputTokens: result.outputTokens })

    const strategy = JSON.parse(stripJsonFences(result.text))
    return NextResponse.json({ strategy })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg.includes('JSON') ? 'AI returned invalid JSON — try again' : msg }, { status: 500 })
  }
}
