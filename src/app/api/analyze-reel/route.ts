import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import Anthropic from '@anthropic-ai/sdk'
import type { ReelAnalysis } from '@/lib/types'
import { logUsage } from '@/lib/usage-tracker'

// Default persona used when no custom analysis prompt is configured
const DEFAULT_ANALYSIS_PERSONA = `You are an expert Instagram content analyst specializing in spiritual, astrology, and healing content.

Analyze the given reel transcript and extract structured content elements.`

// Appended when using the default persona — enforces the standard 6-field schema
const JSON_FORMAT_REQUIREMENT = `

Return ONLY a valid JSON object with exactly these fields:
{
  "coreInsight": "The core message or insight of this reel in one clear sentence. Example: 'Your birth chart isn't a fixed destiny, but a guide to your potential and areas where you can actively exert your free will to shape your future.'",
  "hook": "The hook or attention-grabbing opening statement used or that could be used. Examples: 'The thing you can't stop fighting for — even when it exhausts you — that's Mars. And it's not random.' or 'You're very good at being independent. The question is — when did independent become a wall?'",
  "whatToCover": "The key content points covered or that should be covered inside the reel",
  "ending": "The ending statement, call to action, or soft invitation. Examples: 'Save this if you finally feel seen. Comment your Mars house below.' or 'Comment your Venus sign and house. I'll share you a guide to decode your love language.'",
  "whyItWorks": "Why this content works for a spiritual/astrology audience — one line",
  "connectsToOffer": "Birth Chart Reading / Hypnotherapy Package / Workshop / PDF / None"
}

Return nothing else — just the JSON object.`

// Appended when a custom prompt is used — lets the prompt define its own fields
const GENERIC_JSON_INSTRUCTION = `

Return ONLY a valid JSON object. Each key should be a camelCase version of the field you were asked to extract (e.g. "hookMechanism", "emotionalTrigger"). Return nothing else — just the JSON object.`

type Provider = 'anthropic' | 'openai' | 'gemini'

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-4-6',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
}

interface ProviderResult {
  text: string
  inputTokens: number
  outputTokens: number
}

async function analyzeWithGemini(transcript: string, systemPrompt: string, model: string): Promise<ProviderResult> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const geminiModel = genAI.getGenerativeModel({ model, systemInstruction: systemPrompt })
  const result = await geminiModel.generateContent(`Transcript:\n${transcript}`)
  const meta = result.response.usageMetadata
  return {
    text: result.response.text().trim(),
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: meta?.candidatesTokenCount ?? 0,
  }
}

async function analyzeWithAnthropic(transcript: string, systemPrompt: string, model: string): Promise<ProviderResult> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model,
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: `Transcript:\n${transcript}` }],
  })
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from Claude')
  return {
    text: textBlock.text.trim(),
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }
}

async function analyzeWithOpenAI(transcript: string, systemPrompt: string, model: string): Promise<ProviderResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: `Transcript:\n${transcript}` }],
      max_tokens: 1000,
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`)
  const data = await res.json()
  return {
    text: (data.choices[0].message.content as string).trim(),
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  }
}

export async function POST(req: NextRequest) {
  const { transcript, systemPrompt: customPrompt, provider: requestedProvider, model: requestedModel } = await req.json()

  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'transcript required' }, { status: 400 })
  }

  const provider = (requestedProvider ?? 'gemini') as Provider
  const model = requestedModel ?? DEFAULT_MODELS[provider]
  const systemPrompt = customPrompt?.trim()
    ? customPrompt.trim() + GENERIC_JSON_INSTRUCTION
    : DEFAULT_ANALYSIS_PERSONA + JSON_FORMAT_REQUIREMENT

  const keyMap: Record<Provider, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  }
  if (!keyMap[provider]) {
    return NextResponse.json({ error: `API key for ${provider} not set` }, { status: 500 })
  }

  try {
    let result: ProviderResult
    if (provider === 'anthropic') result = await analyzeWithAnthropic(transcript, systemPrompt, model)
    else if (provider === 'openai') result = await analyzeWithOpenAI(transcript, systemPrompt, model)
    else result = await analyzeWithGemini(transcript, systemPrompt, model)

    await logUsage({
      timestamp: new Date().toISOString(),
      provider,
      model,
      feature: 'analysis',
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    })

    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const analysis: ReelAnalysis = JSON.parse(jsonMatch[0])
    return NextResponse.json({ analysis })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
