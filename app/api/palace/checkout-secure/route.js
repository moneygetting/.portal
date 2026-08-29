import { NextResponse } from 'next/server'
import { decryptTicket, encryptTicket, storeTicket, logStep, corsHeaders } from '@/lib/palace/core.js'

export async function POST(request) {
  const origin = request.headers.get('origin') || ''
  logStep('API:CHECKOUT', 'Received checkout request from Wix/client', 'START', { origin })
  try {
    const body = await request.json()
    if (body.ticket) {
      logStep('API:CHECKOUT', 'Decrypting existing checkout ticket', 'START')
      const payload = decryptTicket(body.ticket)
      logStep('API:CHECKOUT', 'Ticket decrypted and validated successfully (200 OK)', 'SUCCESS')
      return NextResponse.json({ ok: true, payload }, { status: 200, headers: corsHeaders(origin) })
    }

    const required = ['studentNumber', 'computerNumber', 'nationalIdNumber', 'productNumber', 'timestamp']
    const missing = required.filter((key) => !(typeof body[key] === 'string' && body[key].trim()))
    if (missing.length > 0) {
      logStep('API:CHECKOUT', `Checkout creation failed: missing fields [${missing.join(', ')}]`, 'WARN')
      return NextResponse.json({ ok: false, code: 'INVALID_CHECKOUT' }, { status: 400, headers: corsHeaders(origin) })
    }

    logStep('API:CHECKOUT', 'Encrypting new checkout ticket', 'START', { computerNumber: body.computerNumber, productNumber: body.productNumber })
    const ticket = encryptTicket(body)
    storeTicket(ticket)
    
    logStep('API:CHECKOUT', 'Checkout ticket created and stored successfully (201 Created)', 'SUCCESS', { computerNumber: body.computerNumber })
    return NextResponse.json({ ok: true, ticket }, { status: 201, headers: corsHeaders(origin) })
  } catch (err) {
    logStep('API:CHECKOUT', `Checkout request failed: ${err.message}`, 'FAILED')
    return NextResponse.json({ ok: false, code: 'INVALID_CHECKOUT' }, { status: 400, headers: corsHeaders(origin) })
  }
}

export function OPTIONS(request) {
  const origin = request?.headers?.get('origin') || ''
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

