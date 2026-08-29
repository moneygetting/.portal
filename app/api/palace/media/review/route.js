import { NextResponse } from 'next/server'
import { connectDatabase, Student } from '@/lib/db/index.js'
import { createPrivateReadUrl, firebaseConfigured } from '@/lib/portal/firebase-admin.js'
import { readSession } from '@/lib/portal/lifecycle.js'
import { logStep, corsHeaders } from '@/lib/palace/core.js'

export async function GET(request) {
  const origin = request.headers.get('origin') || ''
  logStep('API:REVIEW', 'Received GET media review request', 'START', { origin })
  const session = readSession(request)
  if (!session || session.role !== 'admin') {
    logStep('API:REVIEW', 'Media review failed: admin authorization required', 'WARN')
    return NextResponse.json({ ok: false, code: 'ADMIN_ONLY' }, { status: 403, headers: corsHeaders(origin) })
  }
  if (!firebaseConfigured()) {
    logStep('API:REVIEW', 'Media review failed: Firebase Storage not configured', 'WARN')
    return NextResponse.json({ ok: false, code: 'MEDIA_STORAGE_NOT_CONFIGURED' }, { status: 503, headers: corsHeaders(origin) })
  }

  try {
    logStep('API:REVIEW', 'Querying pending students from MongoDB', 'START')
    await connectDatabase()
    const rows = await Student.find({ status: 'pending', photoFresh: true }).select('computerNumber studentNumber firstName lastName selfieUrl nationalIdUrl photoCapturedAt photoFresh status').lean()
    
    logStep('API:REVIEW', `Generating signed temporary read URLs for ${rows.length} student(s)`, 'START', { count: rows.length })
    const students = await Promise.all(rows.map(async (row) => ({
      ...row,
      selfieViewUrl: row.selfieUrl ? await createPrivateReadUrl(row.selfieUrl) : null,
      nationalIdViewUrl: row.nationalIdUrl ? await createPrivateReadUrl(row.nationalIdUrl) : null,
    })))
    
    logStep('API:REVIEW', 'Media review list processed successfully (200 OK)', 'SUCCESS', { count: students.length })
    return NextResponse.json({ ok: true, students }, { status: 200, headers: corsHeaders(origin) })
  } catch (err) {
    logStep('API:REVIEW', `Media review request failed: ${err.message}`, 'FAILED')
    return NextResponse.json({ ok: false, code: 'MEDIA_REVIEW_UNAVAILABLE' }, { status: 503, headers: corsHeaders(origin) })
  }
}

export function OPTIONS(request) {
  const origin = request?.headers?.get('origin') || ''
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

