import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ReelAnalysis } from '@/lib/types'

const SYSTEM_PROMPT = `You are an expert Instagram content analyst specializing in spiritual, astrology, and healing content.

Analyze the given reel transcript and extract structured content elements.

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

export async function POST(req: NextRequest) {
  const { transcript } = await req.json()

  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'transcript required' }, { status: 400 })
  }

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 })
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: SYSTEM_PROMPT,
    })

    const result = await model.generateContent(`Transcript:\n${transcript}`)
    const text = result.response.text().trim()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in Gemini response')

    const analysis: ReelAnalysis = JSON.parse(jsonMatch[0])
    return NextResponse.json({ analysis })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
