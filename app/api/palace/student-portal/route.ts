import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders } from '@/lib/palace/core'
import { adminKeyMatches, createResult, getResults, isComputerNumber as legacyComputerNumber, studentTokenMatches } from '@/lib/palace/results'
import { isComputerNumber, readSession } from '@/lib/palace/lifecycle'

const json = (request: NextRequest, body: unknown, status = 200) => NextResponse.json(body, { status, headers: corsHeaders(request.headers.get('origin') || undefined) })
export async function OPTIONS(request: NextRequest) { return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin') || undefined) }) }

export async function GET(request: NextRequest) {
  const requested = new URL(request.url).searchParams.get('computerNumber')
  if (!isComputerNumber(requested)) return json(request, { ok: false, code: 'INVALID_COMPUTER_NUMBER' }, 400)
  const session = readSession(request)
  const isAdmin = adminKeyMatches(request.headers.get('x-palace-admin-key')) || session?.role === 'admin'
  const sessionStudent = session?.role === 'student' && session.computerNumber
  const legacyStudent = studentTokenMatches(requested, request.headers.get('x-student-token'))
  if (!isAdmin && !sessionStudent && !legacyStudent) return json(request, { ok: false, code: session ? 'FORBIDDEN' : 'UNAUTHORIZED' }, session ? 403 : 401)
  const computerNumber = isAdmin ? requested : sessionStudent || (legacyStudent ? requested : '')
  if (!computerNumber || (!isAdmin && computerNumber !== requested)) return json(request, { ok: false, code: 'FORBIDDEN' }, 403)
  try { return json(request, { ok: true, computerNumber, results: await getResults(computerNumber) }) } catch { return json(request, { ok: false, code: 'DATABASE_UNAVAILABLE' }, 503) }
}

export async function POST(request: NextRequest) {
  const session = readSession(request)
  if (!adminKeyMatches(request.headers.get('x-palace-admin-key')) && session?.role !== 'admin') return json(request, { ok: false, code: session ? 'ADMIN_ONLY' : 'UNAUTHORIZED' }, session ? 403 : 401)
  try {
    const body = await request.json() as Record<string, unknown>
    if (!legacyComputerNumber(body.computerNumber) || typeof body.subject !== 'string' || body.subject.trim().length < 1 || body.subject.trim().length > 120 || typeof body.term !== 'string' || body.term.trim().length < 1 || body.term.trim().length > 80 || typeof body.mark !== 'number' || !Number.isInteger(body.mark) || body.mark < 0 || body.mark > 100 || (body.fileName !== undefined && (typeof body.fileName !== 'string' || body.fileName.length > 255)) || (body.fileSize !== undefined && (typeof body.fileSize !== 'number' || !Number.isInteger(body.fileSize) || body.fileSize < 0 || body.fileSize > 25_000_000))) return json(request, { ok: false, code: 'INVALID_RESULT_PAYLOAD' }, 400)
    const [result] = await createResult({ computerNumber: body.computerNumber, subject: body.subject, mark: body.mark, term: body.term, fileName: typeof body.fileName === 'string' ? body.fileName : undefined, fileSize: typeof body.fileSize === 'number' ? body.fileSize : undefined, uploadedBy: 'admin' })
    return json(request, { ok: true, result }, 201)
  } catch { return json(request, { ok: false, code: 'DATABASE_UNAVAILABLE' }, 503) }
}
