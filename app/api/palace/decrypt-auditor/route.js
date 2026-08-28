import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { decryptTicket } from '../../../lib/palace/core.js'

function authorized(value) {
  const expected = process.env.PALACE_ADMIN_KEY
  return Boolean(expected && value && value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected)))
}

export async function POST(request) {
  if (!authorized(request.headers.get('x-palace-admin-key'))) return NextResponse.json({ ok: false, code: 'ADMIN_ONLY' }, { status: 403 })
  try {
    const { key } = await request.json()
    return NextResponse.json({ ok: true, payload: decryptTicket(String(key || '')) })
  } catch { return NextResponse.json({ ok: false, code: 'INVALID_TICKET' }, { status: 400 }) }
}
