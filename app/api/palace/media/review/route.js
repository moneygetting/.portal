import { NextResponse } from 'next/server'
import { connectDatabase, Student } from '../../../../lib/db/index.js'
import { createPrivateReadUrl, firebaseConfigured } from '../../../../lib/portal/firebase-admin.js'
import { readSession } from '../../../../lib/portal/lifecycle.js'

export async function GET(request) {
  const session = readSession(request)
  if (!session || session.role !== 'admin') return NextResponse.json({ ok: false, code: 'ADMIN_ONLY' }, { status: 403 })
  if (!firebaseConfigured()) return NextResponse.json({ ok: false, code: 'MEDIA_STORAGE_NOT_CONFIGURED' }, { status: 503 })
  try {
    await connectDatabase()
    const rows = await Student.find({ status: 'pending', photoFresh: true }).select('computerNumber studentNumber firstName lastName selfieUrl nationalIdUrl photoCapturedAt photoFresh status').lean()
    const students = await Promise.all(rows.map(async (row) => ({
      ...row,
      selfieViewUrl: row.selfieUrl ? await createPrivateReadUrl(row.selfieUrl) : null,
      nationalIdViewUrl: row.nationalIdUrl ? await createPrivateReadUrl(row.nationalIdUrl) : null,
    })))
    return NextResponse.json({ ok: true, students })
  } catch { return NextResponse.json({ ok: false, code: 'MEDIA_REVIEW_UNAVAILABLE' }, { status: 503 }) }
}
