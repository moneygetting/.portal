import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { validateProfile } from '../../../../lib/palace/core.js'
import { getStudentByNationalId, getStudentByComputerNumber, issueSession, readSession, signupStudent, semesterSignIn, isComputerNumber } from '../../../../lib/portal/lifecycle.js'

const response = (body, status = 200) => NextResponse.json(body, { status })
const hashPassword = (password) => crypto.scryptSync(password, process.env.PALACE_SECRET_KEY || 'local-development-only-secret', 32).toString('hex')

export async function POST(request) {
  try {
    const body = await request.json()
    const action = String(body.action || 'HANDSHAKE').toUpperCase()
    if (action === 'SIGN_UP') {
      const profile = validateProfile(body.profile || body)
      if (!profile || typeof body.password !== 'string' || body.password.length < 8) return response({ ok: false, code: 'INVALID_PAYLOAD' }, 400)
      const student = await signupStudent({ ...profile, passwordHash: hashPassword(body.password) })
      return response({ ok: true, profile: student, sessionToken: issueSession({ role: 'student', computerNumber: student.computerNumber }) }, 201)
    }
    if (action === 'SIGN_IN') {
      if (!isComputerNumber(body.computerNumber)) return response({ ok: false, code: 'INVALID_COMPUTER_NUMBER' }, 400)
      const student = await semesterSignIn(body.computerNumber)
      return response({ ok: true, profile: student, sessionToken: issueSession({ role: 'student', computerNumber: student.computerNumber }) })
    }
    if (action === 'LOGIN') {
      const session = readSession(request)
      if (!session?.computerNumber) return response({ ok: false, code: 'UNAUTHORIZED' }, 401)
      const student = await getStudentByComputerNumber(session.computerNumber)
      return student ? response({ ok: true, profile: student, sessionToken: issueSession({ role: 'student', computerNumber: student.computerNumber }) }) : response({ ok: false, code: 'NOT_FOUND' }, 404)
    }
    const student = await getStudentByNationalId(String(body.nationalIdNumber || '').trim())
    return student ? response({ ok: true, profile: student }) : response({ ok: false, code: 'NOT_FOUND' }, 404)
  } catch (error) {
    return response({ ok: false, code: error.code || 'REQUEST_FAILED' }, error.code === 'CONFLICT' ? 409 : error.code === 'NOT_FOUND' ? 404 : 400)
  }
}

export function OPTIONS() { return new NextResponse(null, { status: 204 }) }
