import { NextRequest, NextResponse } from 'next/server'
import { generatePptxBuffer } from '@/lib/ppt-generator'
import { BUILT_IN_TEMPLATES, type PptTemplate, type SlideData } from '@/lib/masterclass-templates'

export async function POST(req: NextRequest) {
  const {
    slides, template: templateArg, templateId, fileName,
  }: {
    slides: SlideData[]
    template?: PptTemplate
    templateId?: string
    fileName?: string
  } = await req.json()

  if (!slides?.length) return NextResponse.json({ error: 'No slides provided' }, { status: 400 })

  // Allow passing a full custom template object or just a built-in template ID
  const template: PptTemplate =
    templateArg ??
    BUILT_IN_TEMPLATES.find((t) => t.id === templateId) ??
    BUILT_IN_TEMPLATES[0]

  try {
    const buffer = await generatePptxBuffer(slides, template)
    const safeName = (fileName ?? 'masterclass').replace(/[^a-z0-9_\-\s]/gi, '').trim() || 'masterclass'
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${safeName}.pptx"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
