import { NextResponse } from 'next/server'
import { adminKeyMatches, createResult, getResults, isComputerNumber, studentTokenMatches } from '../../../../lib/portal/results.js'
import { readSession } from '../../../../lib/portal/lifecycle.js'

const response = (body, status = 200) => NextResponse.json(body, { status })

export async function GET(request) {
  const computerNumber = new URL(request.url).searchParams.get('computerNumber')
  const session = readSession(request)
  const isAdmin = adminKeyMatches(request.headers.get('x-palace-admin-key')) || session?.role === 'admin'
  const isStudent = session?.role === 'student' && session.computerNumber === computerNumber
  const tokenMatches = studentTokenMatches(computerNumber, request.headers.get('x-student-token'))
  if (!isComputerNumber(computerNumber)) return response({ ok: false, code: 'INVALID_COMPUTER_NUMBER' }, 400)
  if (!isAdmin && !isStudent && !tokenMatches) return response({ ok: false, code: 'UNAUTHORIZED' }, 401)
  try { return response({ ok: true, computerNumber, results: await getResults(computerNumber) }) } catch { return response({ ok: false, code: 'DATABASE_UNAVAILABLE' }, 503) }
}

export async function POST(request) {
  const session = readSession(request)
  if (!adminKeyMatches(request.headers.get('x-palace-admin-key')) && session?.role !== 'admin') return response({ ok: false, code: 'ADMIN_ONLY' }, 403)
  try {
    const body = await request.json()
    if (!isComputerNumber(body.computerNumber) || typeof body.subject !== 'string' || !body.subject.trim() || typeof body.term !== 'string' || !body.term.trim() || !Number.isInteger(body.mark) || body.mark < 0 || body.mark > 100) return response({ ok: false, code: 'INVALID_RESULT_PAYLOAD' }, 400)
    const result = await createResult({ ...body, uploadedBy: 'admin' })
    return response({ ok: true, result }, 201)
  } catch { return response({ ok: false, code: 'DATABASE_UNAVAILABLE' }, 503) }
}
