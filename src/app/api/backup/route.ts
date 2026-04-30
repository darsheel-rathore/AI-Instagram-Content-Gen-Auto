import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), 'data')
// Keys that are user preferences, not data — preserved on clear
const PRESERVE_ON_CLEAR = new Set(['settings', 'recycle_bin'])

export async function GET() {
  const backup: Record<string, unknown> = {}

  if (fs.existsSync(DATA_DIR)) {
    for (const f of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
      const key = f.replace('.json', '')
      try {
        backup[key] = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'))
      } catch {
        // skip corrupted file
      }
    }
  }

  const date = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="dashboard-backup-${date}.json"`,
    },
  })
}

export async function DELETE() {
  if (!fs.existsSync(DATA_DIR)) return NextResponse.json({ ok: true, deleted: [] })

  const deleted: string[] = []
  for (const f of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))) {
    const key = f.replace('.json', '')
    if (PRESERVE_ON_CLEAR.has(key)) continue
    fs.unlinkSync(path.join(DATA_DIR, f))
    deleted.push(key)
  }

  return NextResponse.json({ ok: true, deleted })
}
