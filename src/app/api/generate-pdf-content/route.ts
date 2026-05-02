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

const MODEL_PREFIXES: Record<Provider, string[]> = {
  anthropic: ['claude-'],
  openai: ['gpt-', 'o1-', 'o3-'],
  gemini: ['gemini-'],
}

function resolveModel(reqModel: string | undefined, provider: Provider): string {
  if (reqModel && MODEL_PREFIXES[provider].some((p) => reqModel.startsWith(p))) return reqModel
  return DEFAULT_MODELS[provider]
}

// Appended after the user's prompt — never visible to the end reader, purely structural
const FORMAT_SUFFIX = `

---
CRITICAL — return ONLY valid JSON. No markdown fences. No commentary. Exact schema:
{
  "title": "Short, evocative title (6-10 words)",
  "subtitle": "One precise sentence capturing the takeaway (15-20 words)",
  "intro": "2-3 sentences creating emotional resonance before content begins",
  "sections": [
    {
      "heading": "Section title (3-6 words, chapter-name feel)",
      "body": "2-3 paragraphs. Teach one thing deeply. Warm, intelligent, direct.",
      "insight": "One-sentence distillation. Start with 'The truth is...' or 'What most people miss:'"
    }
  ],
  "reflectionQuestions": [
    "Specific, probing questions tied directly to the content — not generic prompts"
  ],
  "closingNote": "2-3 sentences. A gentle push forward, not a sales pitch.",
  "ctaText": "An invitation, not a command. 10-20 words that feel like permission."
}
Fill every field. sections: 4-6 items. reflectionQuestions: 3-5 items.`

async function callAnthropic(userMsg: string, systemPrompt: string, model: string): Promise<ProviderResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model,
    max_tokens: 3000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMsg }],
  })
  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('No text response from Claude')
  return {
    text: block.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

async function callOpenAI(userMsg: string, systemPrompt: string, model: string): Promise<ProviderResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
      max_tokens: 3000,
      temperature: 0.6,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`)
  const data = await res.json()
  return {
    text: data.choices[0].message.content as string,
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  }
}

async function callGemini(userMsg: string, systemPrompt: string, model: string): Promise<ProviderResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const geminiModel = genAI.getGenerativeModel({ model, systemInstruction: systemPrompt })
  const result = await geminiModel.generateContent(userMsg)
  const meta = result.response.usageMetadata
  return {
    text: result.response.text(),
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
  }
}

function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

export async function POST(req: NextRequest) {
  const {
    ctaText,
    customPrompt,
    provider: reqProvider,
    model: reqModel,
  }: {
    ctaText?: string
    customPrompt?: string
    provider?: string
    model?: string
  } = await req.json()

  if (!customPrompt?.trim()) {
    return NextResponse.json(
      { error: 'No prompt provided — create one in Prompt Factory inside PDF Export' },
      { status: 400 },
    )
  }

  if (!ctaText?.trim()) {
    return NextResponse.json({ error: 'No CTA / topic provided' }, { status: 400 })
  }

  const provider = ((reqProvider ?? 'gemini') as Provider)
  const model = resolveModel(reqModel, provider)

  const keyMap: Record<Provider, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  }
  const envMap: Record<Provider, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
  }
  if (!keyMap[provider]) {
    return NextResponse.json({ error: `${envMap[provider]} not set` }, { status: 500 })
  }

  // User's Prompt Factory content drives all content decisions; FORMAT_SUFFIX enforces JSON shape
  const systemPrompt = customPrompt.trimEnd() + FORMAT_SUFFIX

  try {
    const callers: Record<Provider, () => Promise<ProviderResult>> = {
      anthropic: () => callAnthropic(ctaText.trim(), systemPrompt, model),
      openai: () => callOpenAI(ctaText.trim(), systemPrompt, model),
      gemini: () => callGemini(ctaText.trim(), systemPrompt, model),
    }
    const result = await callers[provider]()

    logUsage({
      timestamp: new Date().toISOString(),
      provider,
      model,
      feature: 'pdf-giveaway',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })

    const cleaned = stripJsonFences(result.text)
    const parsed = JSON.parse(cleaned)
    return NextResponse.json({ ...parsed, generatedAt: new Date().toISOString() })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('JSON')) {
      return NextResponse.json({ error: 'AI returned invalid JSON — try again or switch model' }, { status: 500 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
