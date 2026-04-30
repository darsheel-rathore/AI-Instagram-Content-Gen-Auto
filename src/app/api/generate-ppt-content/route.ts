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

const SYSTEM_PROMPT = `You are an expert presentation designer creating PowerPoint slides for a masterclass.

Given details about the masterclass, generate a complete slide deck as a JSON array. Each slide has this structure:

{
  "type": "title" | "agenda" | "content" | "section" | "closing",
  "title": "Slide heading (short, impactful)",
  "subtitle": "Optional subtitle (only for title/closing slides)",
  "points": ["Bullet point 1", "Bullet point 2", ...],
  "notes": "Speaker notes for this slide"
}

Guidelines:
- title slide: 1 slide with main title + subtitle
- agenda slide: 1 slide listing main sections (no more than 6 points)
- section slides: introduce each major section
- content slides: 3-5 bullet points per slide, crisp and actionable
- closing slide: thank you + call to action
- Total: 12-20 slides depending on complexity
- Keep bullet points under 10 words each
- Speaker notes should be full sentences (what the presenter actually says)

Return ONLY a valid JSON array. No explanation, no markdown fences.`

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

async function callAnthropic(prompt: string, model: string): Promise<ProviderResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model,
    max_tokens: 4000,
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
      max_tokens: 4000,
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
    title, description, targetAudience, keyTopics, price, customPrompt, provider: reqProvider, model: reqModel,
  }: {
    title: string
    description: string
    targetAudience?: string
    keyTopics?: string
    price?: number
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
    `Masterclass Title: ${title}`,
    description ? `Description: ${description}` : '',
    targetAudience ? `Target Audience: ${targetAudience}` : '',
    keyTopics ? `Key Topics: ${keyTopics}` : '',
    price ? `Price: ₹${price}` : '',
    customPrompt ? `\nAdditional Instructions:\n${customPrompt}` : '',
  ].filter(Boolean).join('\n')

  try {
    const callers: Record<Provider, () => Promise<ProviderResult>> = {
      anthropic: () => callAnthropic(userPrompt, model),
      openai: () => callOpenAI(userPrompt, model),
      gemini: () => callGemini(userPrompt, model),
    }
    const result = await callers[provider]()

    logUsage({ timestamp: new Date().toISOString(), provider, model, feature: 'ppt-generation', inputTokens: result.inputTokens, outputTokens: result.outputTokens })

    const slides = JSON.parse(stripJsonFences(result.text))
    return NextResponse.json({ slides })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg.includes('JSON') ? 'AI returned invalid JSON — try again' : msg }, { status: 500 })
  }
}
