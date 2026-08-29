import { NextResponse } from 'next/server'
import { adminKeyMatches, createResult, getResults, isComputerNumber, studentTokenMatches } from '@/lib/portal/results.js'
import { readSession } from '@/lib/portal/lifecycle.js'
import { logStep, corsHeaders } from '@/lib/palace/core.js'

const response = (body, status = 200, origin = '') => NextResponse.json(body, { status, headers: corsHeaders(origin) })

export function OPTIONS(request) {
  const origin = request?.headers?.get('origin') || ''
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET(request) {
  const origin = request.headers.get('origin') || ''
  const computerNumber = new URL(request.url).searchParams.get('computerNumber')
  logStep('API:RESULTS', 'Received GET results request from Wix/client', 'START', { computerNumber, origin })

  logStep('API:RESULTS', 'Checking caller authorization', 'START', { computerNumber })
  const session = readSession(request)
  const isAdmin = adminKeyMatches(request.headers.get('x-palace-admin-key')) || session?.role === 'admin'
  const isStudent = session?.role === 'student' && session.computerNumber === computerNumber
  const tokenMatches = studentTokenMatches(computerNumber, request.headers.get('x-student-token'))

  if (!isComputerNumber(computerNumber)) {
    logStep('API:RESULTS', 'GET results failed: invalid computer number format', 'WARN', { computerNumber })
    return response({ ok: false, code: 'INVALID_COMPUTER_NUMBER' }, 400, origin)
  }
  if (!isAdmin && !isStudent && !tokenMatches) {
    logStep('API:RESULTS', 'GET results failed: unauthorized access attempt', 'WARN', { computerNumber })
    return response({ ok: false, code: 'UNAUTHORIZED' }, 401, origin)
  }

  try {
    logStep('API:RESULTS', 'Fetching results from database', 'START', { computerNumber })
    const results = await getResults(computerNumber)
    logStep('API:RESULTS', 'GET results completed successfully (200 OK)', 'SUCCESS', { computerNumber, count: results.length })
    return response({ ok: true, computerNumber, results }, 200, origin)
  } catch (err) {
    logStep('API:RESULTS', `GET results failed: database error ${err.message}`, 'FAILED')
    return response({ ok: false, code: 'DATABASE_UNAVAILABLE' }, 503, origin)
  }
}

export async function POST(request) {
  const origin = request.headers.get('origin') || ''
  logStep('API:RESULTS', 'Received POST create result request', 'START', { origin })
  const session = readSession(request)
  const isAdmin = adminKeyMatches(request.headers.get('x-palace-admin-key')) || session?.role === 'admin'
  if (!isAdmin) {
    logStep('API:RESULTS', 'POST create result failed: admin authorization required', 'WARN')
    return response({ ok: false, code: 'ADMIN_ONLY' }, 403, origin)
  }

  try {
    const body = await request.json()
    logStep('API:RESULTS', 'Validating new result payload', 'START', { computerNumber: body.computerNumber, subject: body.subject, mark: body.mark })
    if (!isComputerNumber(body.computerNumber) || typeof body.subject !== 'string' || !body.subject.trim() || typeof body.term !== 'string' || !body.term.trim() || !Number.isInteger(body.mark) || body.mark < 0 || body.mark > 100) {
      logStep('API:RESULTS', 'POST create result failed: invalid result payload fields', 'WARN')
      return response({ ok: false, code: 'INVALID_RESULT_PAYLOAD' }, 400, origin)
    }
    const result = await createResult({ ...body, uploadedBy: 'admin' })
    logStep('API:RESULTS', 'Result created and saved successfully (201 Created)', 'SUCCESS', { resultId: result._id?.toString() })
    return response({ ok: true, result }, 201, origin)
  } catch (err) {
    logStep('API:RESULTS', `POST create result failed: ${err.message}`, 'FAILED')
    return response({ ok: false, code: 'DATABASE_UNAVAILABLE' }, 503, origin)
  }
}


