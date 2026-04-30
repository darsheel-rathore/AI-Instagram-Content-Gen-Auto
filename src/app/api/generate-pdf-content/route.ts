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

const SYSTEM_PROMPT = `You are a professional content strategy consultant formatting Instagram reel ideas into structured PDF documents.

Convert the provided reel idea content into a clean JSON structure for a high-quality PDF report. This document will be presented to clients or used for strategic content planning.

Return ONLY valid JSON — no explanation, no markdown code fences, just the raw JSON object:
{
  "title": "Compelling title for this content piece (not just the reel idea number — make it descriptive and strategic, 6-10 words)",
  "subtitle": "A sharp, one-line strategic insight or theme (10-16 words max)",
  "sections": [
    {
      "heading": "Section name (3-5 words, title case)",
      "body": "Optional prose paragraph — polished, concise, actionable",
      "items": ["Optional bullet point 1", "Optional bullet point 2"]
    }
  ]
}

Create 5–7 sections. Suggested structure (adapt to available content):
1. Opening Hook — the exact first-3-seconds strategy and why it grabs attention
2. Content Strategy — the core angle, positioning, and narrative arc
3. Key Talking Points — the 3–5 main points to cover (use items array)
4. Target Audience — who this resonates with and why they care
5. Call to Action — ending strategy and desired viewer response
6. Why This Works — the psychological or algorithmic reason for performance
7. Distribution Notes — hashtag themes, optimal format, timing (if inferable)

Make every word count. Language should be sharp, professional, and implementation-ready.`

async function callAnthropic(userPrompt: string, systemPrompt: string, model: string): Promise<ProviderResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('No text response from Claude')
  return {
    text: block.text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

async function callOpenAI(userPrompt: string, systemPrompt: string, model: string): Promise<ProviderResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      max_tokens: 2000,
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

async function callGemini(userPrompt: string, systemPrompt: string, model: string): Promise<ProviderResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const geminiModel = genAI.getGenerativeModel({ model, systemInstruction: systemPrompt })
  const result = await geminiModel.generateContent(userPrompt)
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
    content,
    customPrompt,
    provider: reqProvider,
    model: reqModel,
    ideaTitle,
  }: {
    content: string
    customPrompt?: string
    provider?: string
    model?: string
    ideaTitle?: string
  } = await req.json()

  if (!content?.trim()) {
    return NextResponse.json({ error: 'No content provided' }, { status: 400 })
  }

  const provider = ((reqProvider ?? 'gemini') as Provider)
  const model = reqModel ?? DEFAULT_MODELS[provider]

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

  const systemPrompt = customPrompt?.trim()
    ? `${SYSTEM_PROMPT}\n\nAdditional instructions from the user:\n${customPrompt}`
    : SYSTEM_PROMPT

  const userPrompt = `${ideaTitle ? `Reel Idea: ${ideaTitle}\n\n` : ''}Content to format:\n\n${content}`

  try {
    const callers: Record<Provider, () => Promise<ProviderResult>> = {
      anthropic: () => callAnthropic(userPrompt, systemPrompt, model),
      openai: () => callOpenAI(userPrompt, systemPrompt, model),
      gemini: () => callGemini(userPrompt, systemPrompt, model),
    }
    const result = await callers[provider]()

    logUsage({
      timestamp: new Date().toISOString(),
      provider,
      model,
      feature: 'pdf-generation',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })

    const cleaned = stripJsonFences(result.text)
    const parsed = JSON.parse(cleaned) as {
      title: string
      subtitle: string
      sections: Array<{ heading: string; body?: string; items?: string[] }>
    }
    return NextResponse.json({ ...parsed, generatedAt: new Date().toISOString() })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('JSON')) {
      return NextResponse.json({ error: 'AI returned invalid JSON — try again or switch model' }, { status: 500 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
