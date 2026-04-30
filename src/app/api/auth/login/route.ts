import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { makeSessionToken, SESSION_COOKIE, SESSION_TTL } from '@/lib/session'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const validUsername = process.env.AUTH_USERNAME
  const passwordHash = process.env.AUTH_PASSWORD_HASH
  const secret = process.env.AUTH_SECRET

  if (!validUsername || !passwordHash || !secret) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 })
  }

  const usernameMatch = username === validUsername
  const passwordMatch = usernameMatch && await bcrypt.compare(password, passwordHash)

  if (!passwordMatch) {
    // Same error for wrong username or wrong password — no enumeration
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 })
  }

  const token = await makeSessionToken(secret)
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''

  const res = NextResponse.json({ ok: true })
  res.headers.set(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL}${secure}`,
  )
  return res
}
