import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { decryptTicket, logStep, corsHeaders } from '@/lib/palace/core.js'

function authorized(value) {
  const expected = process.env.PALACE_ADMIN_KEY
  return Boolean(expected && value && value.length === expected.length && crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected)))
}

export async function POST(request) {
  const origin = request.headers.get('origin') || ''
  logStep('API:AUDITOR', 'Received decrypt audit request', 'START', { origin })
  if (!authorized(request.headers.get('x-palace-admin-key'))) {
    logStep('API:AUDITOR', 'Audit request failed: invalid admin key', 'WARN')
    return NextResponse.json({ ok: false, code: 'ADMIN_ONLY' }, { status: 403, headers: corsHeaders(origin) })
  }
  try {
    const { key } = await request.json()
    logStep('API:AUDITOR', 'Decrypting audited ticket key', 'START')
    const payload = decryptTicket(String(key || ''))
    logStep('API:AUDITOR', 'Ticket audit decrypted successfully (200 OK)', 'SUCCESS', { computerNumber: payload.computerNumber, productNumber: payload.productNumber })
    return NextResponse.json({ ok: true, payload }, { status: 200, headers: corsHeaders(origin) })
  } catch (err) {
    logStep('API:AUDITOR', `Audit decryption failed: ${err.message}`, 'FAILED')
    return NextResponse.json({ ok: false, code: 'INVALID_TICKET' }, { status: 400, headers: corsHeaders(origin) })
  }
}

export function OPTIONS(request) {
  const origin = request?.headers?.get('origin') || ''
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

