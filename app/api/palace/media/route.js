import { NextResponse } from 'next/server'
import { connectDatabase, Student } from '@/lib/db/index.js'
import { readSession } from '@/lib/portal/lifecycle.js'
import { logStep, corsHeaders } from '@/lib/palace/core.js'

function response(body, status = 200, origin = '') {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) })
}

function freshCapture(value) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp <= Date.now() && Date.now() - timestamp <= 14 * 24 * 60 * 60 * 1000
}

function validPath(value, computerNumber, type) {
  return typeof value === 'string' && value.startsWith(`student-media/${computerNumber}/${type}/`) && !value.includes('..') && !value.includes('http')
}

export function OPTIONS(request) {
  const origin = request?.headers?.get('origin') || ''
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function PUT(request) {
  const origin = request.headers.get('origin') || ''
  logStep('API:MEDIA', 'Received PUT media update request', 'START', { origin })
  const session = readSession(request)
  if (!session || session.role !== 'student' || !session.computerNumber) {
    logStep('API:MEDIA', 'PUT media failed: unauthorized student session', 'WARN')
    return response({ ok: false, code: 'UNAUTHORIZED' }, 401, origin)
  }

  try {
    const body = await request.json()
    const type = body.type === 'nationalId' ? 'national-id' : body.type
    logStep('API:MEDIA', `Validating media update payload for type=${type}`, 'START', { computerNumber: session.computerNumber, type })

    if (!['selfie', 'national-id'].includes(type) || !validPath(body.url, session.computerNumber, type) || !freshCapture(body.capturedAt)) {
      logStep('API:MEDIA', 'PUT media failed: invalid path, expired capture, or illegal type', 'WARN', { url: body.url, capturedAt: body.capturedAt })
      return response({ ok: false, code: 'INVALID_MEDIA' }, 400, origin)
    }

    logStep('API:MEDIA', 'Updating student media record in MongoDB', 'START', { computerNumber: session.computerNumber, type })
    await connectDatabase()
    const update = type === 'selfie' ? { selfieUrl: body.url, photoCapturedAt: new Date(body.capturedAt), photoFresh: true } : { nationalIdUrl: body.url }
    const student = await Student.findOneAndUpdate({ computerNumber: session.computerNumber }, { $set: update }, { new: true }).select('computerNumber selfieUrl nationalIdUrl photoCapturedAt photoFresh').lean()
    
    if (!student) {
      logStep('API:MEDIA', 'PUT media failed: student record not found', 'WARN', { computerNumber: session.computerNumber })
      return response({ ok: false, code: 'STUDENT_NOT_FOUND' }, 404, origin)
    }

    logStep('API:MEDIA', 'Media update saved successfully (200 OK)', 'SUCCESS', { computerNumber: session.computerNumber, type })
    return response({ ok: true, media: student }, 200, origin)
  } catch (err) {
    logStep('API:MEDIA', `PUT media failed: ${err.message}`, 'FAILED')
    return response({ ok: false, code: 'DATABASE_UNAVAILABLE' }, 503, origin)
  }
}

export async function GET(request) {
  const origin = request.headers.get('origin') || ''
  logStep('API:MEDIA', 'Received GET pending media reviews request', 'START', { origin })
  const session = readSession(request)
  if (!session || session.role !== 'admin') {
    logStep('API:MEDIA', 'GET pending media reviews failed: admin authorization required', 'WARN')
    return response({ ok: false, code: 'ADMIN_ONLY' }, session ? 403 : 401, origin)
  }

  try {
    await connectDatabase()
    const students = await Student.find({ status: 'pending', photoFresh: true }).select('computerNumber studentNumber firstName lastName selfieUrl nationalIdUrl photoCapturedAt photoFresh').lean()
    logStep('API:MEDIA', `Retrieved ${students.length} pending student media submissions`, 'SUCCESS', { count: students.length })
    return response({ ok: true, students }, 200, origin)
  } catch (err) {
    logStep('API:MEDIA', `GET pending media failed: ${err.message}`, 'FAILED')
    return response({ ok: false, code: 'DATABASE_UNAVAILABLE' }, 503, origin)
  }
}

