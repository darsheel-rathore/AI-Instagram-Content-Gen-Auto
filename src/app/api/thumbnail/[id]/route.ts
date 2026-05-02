import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const THUMB_DIR = path.join(process.cwd(), 'data', 'thumbnails')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const safeId = id.replace(/[^a-z0-9_-]/gi, '_')
  const file = path.join(THUMB_DIR, `${safeId}.jpg`)
  if (!fs.existsSync(file)) return new NextResponse('not found', { status: 404 })
  const buffer = fs.readFileSync(file)
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000',
    },
  })
}
