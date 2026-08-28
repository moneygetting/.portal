import { NextResponse } from 'next/server'
import { createPrivateUploadUrl, firebaseConfigured, privateObjectPath, safeExtension } from '../../../../lib/portal/firebase-admin.js'
import { readSession, isComputerNumber } from '../../../../lib/portal/lifecycle.js'

export async function POST(request) {
  const session = readSession(request)
  if (!session?.computerNumber || session.role !== 'student') return NextResponse.json({ ok: false, code: 'UNAUTHORIZED' }, { status: 401 })
  if (!firebaseConfigured()) return NextResponse.json({ ok: false, code: 'MEDIA_STORAGE_NOT_CONFIGURED' }, { status: 503 })
  try {
    const body = await request.json()
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!isComputerNumber(session.computerNumber) || !['selfie', 'national-id'].includes(body.type) || !allowed.includes(body.contentType) || !Number.isInteger(body.size) || body.size < 1 || body.size > 10_000_000) return NextResponse.json({ ok: false, code: 'INVALID_UPLOAD' }, { status: 400 })
    const path = privateObjectPath(session.computerNumber, body.type, safeExtension(body.contentType))
    const uploadUrl = await createPrivateUploadUrl(path, body.contentType)
    return NextResponse.json({ ok: true, path, uploadUrl, expiresInSeconds: 600 })
  } catch { return NextResponse.json({ ok: false, code: 'MEDIA_STORAGE_UNAVAILABLE' }, { status: 503 }) }
}

export function OPTIONS() { return new NextResponse(null, { status: 204 }) }
