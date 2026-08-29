import { NextResponse } from 'next/server'
import { getRecentLogs, logStep, corsHeaders } from '@/lib/palace/core.js'

export async function GET(request) {
  const origin = request.headers.get('origin') || ''
  logStep('API:LOGS', 'Received GET system logs request', 'START', { origin })
  if (!process.env.PALACE_ADMIN_KEY || request.headers.get('x-palace-admin-key') !== process.env.PALACE_ADMIN_KEY) {
    logStep('API:LOGS', 'GET logs failed: unauthorized admin key', 'WARN')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders(origin) })
  }
  const events = getRecentLogs()
  logStep('API:LOGS', `Returning ${events.length} recent system step logs (200 OK)`, 'SUCCESS', { count: events.length })
  return NextResponse.json({
    ok: true,
    totalLogs: events.length,
    events,
    note: 'Runtime step logs are also streamed directly to console/stdout.',
  }, { status: 200, headers: corsHeaders(origin) })
}

export function OPTIONS(request) {
  const origin = request?.headers?.get('origin') || ''
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

