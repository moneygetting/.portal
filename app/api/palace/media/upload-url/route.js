import { NextResponse } from 'next/server'
import { createPrivateUploadUrl, firebaseConfigured, privateObjectPath, safeExtension } from '@/lib/portal/firebase-admin.js'
import { readSession, isComputerNumber } from '@/lib/portal/lifecycle.js'
import { logStep, corsHeaders } from '@/lib/palace/core.js'

export async function POST(request) {
  const origin = request.headers.get('origin') || ''
  logStep('API:UPLOAD_URL', 'Received POST signed upload-url request', 'START', { origin })
  const session = readSession(request)
  if (!session?.computerNumber || session.role !== 'student') {
    logStep('API:UPLOAD_URL', 'Upload-url failed: unauthorized student session', 'WARN')
    return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401, headers: corsHeaders(origin) })
  }
  if (!firebaseConfigured()) {
    logStep('API:UPLOAD_URL', 'Upload-url failed: Firebase Storage not configured', 'WARN')
    return NextResponse.json({ ok: false, code: 'MEDIA_STORAGE_NOT_CONFIGURED' }, { status: 503, headers: corsHeaders(origin) })
  }

  try {
    const body = await request.json()
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    logStep('API:UPLOAD_URL', 'Validating media upload payload', 'START', { computerNumber: session.computerNumber, type: body.type, contentType: body.contentType, size: body.size })

    if (!isComputerNumber(session.computerNumber) || !['selfie', 'national-id'].includes(body.type) || !allowed.includes(body.contentType) || !Number.isInteger(body.size) || body.size < 1 || body.size > 10_000_000) {
      logStep('API:UPLOAD_URL', 'Upload-url failed: invalid media type, mime-type, or size > 10MB', 'WARN')
      return NextResponse.json({ ok: false, code: 'INVALID_UPLOAD' }, { status: 400, headers: corsHeaders(origin) })
    }

    const path = privateObjectPath(session.computerNumber, body.type, safeExtension(body.contentType))
    logStep('API:UPLOAD_URL', 'Generating private signed upload URL in Firebase bucket', 'START', { path })
    const uploadUrl = await createPrivateUploadUrl(path, body.contentType)
    
    logStep('API:UPLOAD_URL', 'Signed upload URL generated successfully (200 OK)', 'SUCCESS', { path, expiresInSeconds: 600 })
    return NextResponse.json({ ok: true, path, uploadUrl, expiresInSeconds: 600 }, { status: 200, headers: corsHeaders(origin) })
  } catch (err) {
    logStep('API:UPLOAD_URL', `Upload-url request failed: ${err.message}`, 'FAILED')
    return NextResponse.json({ ok: false, code: 'MEDIA_STORAGE_UNAVAILABLE' }, { status: 503, headers: corsHeaders(origin) })
  }
}

export function OPTIONS(request) {
  const origin = request?.headers?.get('origin') || ''
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

