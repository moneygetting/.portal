import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { corsHeaders, findStudent, validateProfile, type StudentProfile, trace } from '@/lib/palace/core'
import { getStudentByComputerNumber, isComputerNumber, issueSession, readSession, semesterSignIn, signupStudent } from '@/lib/palace/lifecycle'

const response = (request: NextRequest, body: unknown, status = 200) => NextResponse.json(body, { status, headers: corsHeaders(request.headers.get('origin') || undefined) })
const passwordHash = (password: string) => crypto.scryptSync(password, process.env.PALACE_SECRET_KEY || 'local-development-only-secret', 32).toString('hex')
const errorCode = (error: unknown) => error && typeof error === 'object' && 'code' in error ? String((error as { code: string }).code) : ''

export async function OPTIONS(request: NextRequest) { return new NextResponse(null, { status: 204, headers: corsHeaders(request.headers.get('origin') || undefined) }) }

export async function POST(request: NextRequest) {
  const started = Date.now()
  try {
    const body = await request.json() as Record<string, unknown>
    const action = String(body.action || 'HANDSHAKE').toUpperCase()
    if (action === 'SIGN_UP') {
      const required = ['studentNumber', 'computerNumber', 'email', 'firstName', 'lastName', 'nationalIdNumber', 'password']
      if (!required.every((key) => typeof body[key] === 'string' && String(body[key]).trim()) || !isComputerNumber(body.computerNumber)) return response(request, { error: 'Invalid signup payload' }, 400)
      const student = await signupStudent({ studentNumber: String(body.studentNumber).trim(), computerNumber: String(body.computerNumber), email: String(body.email).trim().toLowerCase(), firstName: String(body.firstName).trim(), lastName: String(body.lastName).trim(), nationalId: String(body.nationalIdNumber).trim(), passwordHash: passwordHash(String(body.password)) })
      return response(request, { success: true, profile: student, sessionToken: issueSession({ role: 'student', computerNumber: student.computerNumber }) }, 201)
    }
    if (action === 'SIGN_IN') {
      const computerNumber = body.computerNumber
      if (!isComputerNumber(computerNumber)) return response(request, { error: 'A valid computerNumber is required' }, 400)
      const student = await semesterSignIn(computerNumber)
      return response(request, { success: true, profile: student, sessionToken: issueSession({ role: 'student', computerNumber }) })
    }
    if (action === 'LOGIN') {
      const session = readSession(request)
      if (!session || session.role !== 'student' || !session.computerNumber) return response(request, { error: 'Unauthorized' }, 401)
      const profile = await getStudentByComputerNumber(session.computerNumber)
      if (!profile) return response(request, { error: 'Student not found' }, 404)
      return response(request, { success: true, profile, sessionToken: issueSession({ role: 'student', computerNumber: session.computerNumber }) })
    }
    const nationalIdNumber = String(body.nationalIdNumber || '').trim()
    if (!nationalIdNumber) return response(request, { error: 'nationalIdNumber is required' }, 400)
    const cached = validateProfile(body.cacheData)
    const profile: StudentProfile | null = cached && cached.nationalIdNumber === nationalIdNumber ? cached : await findStudent(nationalIdNumber)
    trace(cached ? 'handshake cache hit' : 'handshake database fallback', { durationMs: Date.now() - started })
    if (!profile) return response(request, { error: 'Student not found' }, 404)
    return response(request, { success: true, profile })
  } catch (error) {
    const code = errorCode(error)
    if (code === 'CONFLICT') return response(request, { error: 'Invalid lifecycle state', code }, 409)
    if (code === 'NOT_FOUND') return response(request, { error: 'Student not found' }, 404)
    console.error('[PALACE] handshake failure', error)
    return response(request, { error: 'Invalid request' }, 400)
  }
}

