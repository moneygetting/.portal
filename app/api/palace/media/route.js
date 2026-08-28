import { NextResponse } from 'next/server'
import { connectDatabase, Student } from '../../../../lib/db/index.js'
import { readSession } from '../../../../lib/portal/lifecycle.js'

function response(body, status = 200) {
  return NextResponse.json(body, { status })
}

function freshCapture(value) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp <= Date.now() && Date.now() - timestamp <= 14 * 24 * 60 * 60 * 1000
}

function validPath(value, computerNumber, type) {
  return typeof value === 'string' && value.startsWith(`student-media/${computerNumber}/${type}/`) && !value.includes('..') && !value.includes('http')
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}

export async function PUT(request) {
  const session = readSession(request)
  if (!session || session.role !== 'student' || !session.computerNumber) return response({ ok: false, code: 'UNAUTHORIZED' }, 401)
  try {
    const body = await request.json()
    const type = body.type === 'nationalId' ? 'national-id' : body.type
    if (!['selfie', 'national-id'].includes(type) || !validPath(body.url, session.computerNumber, type) || !freshCapture(body.capturedAt)) return response({ ok: false, code: 'INVALID_MEDIA' }, 400)
    await connectDatabase()
    const update = type === 'selfie' ? { selfieUrl: body.url, photoCapturedAt: new Date(body.capturedAt), photoFresh: true } : { nationalIdUrl: body.url }
    const student = await Student.findOneAndUpdate({ computerNumber: session.computerNumber }, { $set: update }, { new: true }).select('computerNumber selfieUrl nationalIdUrl photoCapturedAt photoFresh').lean()
    if (!student) return response({ ok: false, code: 'STUDENT_NOT_FOUND' }, 404)
    return response({ ok: true, media: student })
  } catch {
    return response({ ok: false, code: 'DATABASE_UNAVAILABLE' }, 503)
  }
}

export async function GET(request) {
  const session = readSession(request)
  if (!session || session.role !== 'admin') return response({ ok: false, code: 'ADMIN_ONLY' }, session ? 403 : 401)
  await connectDatabase()
  const students = await Student.find({ status: 'pending', photoFresh: true }).select('computerNumber studentNumber firstName lastName selfieUrl nationalIdUrl photoCapturedAt photoFresh').lean()
  return response({ ok: true, students })
}
