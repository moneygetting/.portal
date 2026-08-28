import { NextResponse } from 'next/server'
import { decryptTicket, encryptTicket, storeTicket } from '../../../lib/palace/core.js'

export async function POST(request) {
  try {
    const body = await request.json()
    if (body.ticket) return NextResponse.json({ ok: true, payload: decryptTicket(body.ticket) })
    const required = ['studentNumber', 'computerNumber', 'nationalIdNumber', 'productNumber', 'timestamp']
    if (!required.every((key) => typeof body[key] === 'string' && body[key].trim())) return NextResponse.json({ ok: false, code: 'INVALID_CHECKOUT' }, { status: 400 })
    const ticket = encryptTicket(body)
    storeTicket(ticket)
    return NextResponse.json({ ok: true, ticket }, { status: 201 })
  } catch { return NextResponse.json({ ok: false, code: 'INVALID_CHECKOUT' }, { status: 400 }) }
}

export function OPTIONS() { return new NextResponse(null, { status: 204 }) }
